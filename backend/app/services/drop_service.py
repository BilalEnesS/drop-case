from typing import Sequence

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from app.models import Drop, Waitlist, User
from app.repositories.drop_repo import list_active_drops
from app.repositories.waitlist_repo import upsert_waitlist, delete_waitlist
from app.repositories.claim_repo import get_claim_by_user_and_drop, create_claim_record, try_decrement_stock
from app.services.priority_service import PriorityService
import secrets
from datetime import datetime, timezone


class DropService:
	def __init__(self, db: AsyncSession) -> None:
		self.db = db

	async def list_active(self, offset: int = 0, limit: int = 20) -> Sequence[Drop]:
		# Auto-deactivate expired drops
		await self._auto_deactivate_expired()
		return await list_active_drops(self.db, offset=offset, limit=limit)

	async def _auto_deactivate_expired(self) -> None:
		# Mark drops as inactive if claim_window_end has passed
		# Fetch all active drops and check in Python to avoid timezone issues
		now = datetime.now(tz=timezone.utc)
		drops_res = await self.db.execute(
			select(Drop).where(Drop.is_active == True)  # noqa: E712
		)
		drops = drops_res.scalars().all()
		
		for drop in drops:
			window_end = drop.claim_window_end
			# Ensure timezone-aware for comparison
			if window_end.tzinfo is None:
				window_end = window_end.replace(tzinfo=timezone.utc)
			
			if window_end < now:
				drop.is_active = False
		
		await self.db.commit()

	async def join_waitlist(self, user_id: int, drop_id: int) -> None:
		# Ensure drop exists, is active, and has started
		drop_row = await self.db.execute(select(Drop).where(Drop.id == drop_id))
		drop: Drop | None = drop_row.scalar_one_or_none()
		if not drop or not drop.is_active:
			raise ValueError("drop_not_available")
		
		# Check if drop has started
		now = datetime.now(tz=timezone.utc)
		starts_at = drop.starts_at
		if starts_at.tzinfo is None:
			starts_at = starts_at.replace(tzinfo=timezone.utc)
		if starts_at > now:
			raise ValueError("drop_not_started")
		
		# Track rapid action (every join/leave counts)
		priority_svc = PriorityService(self.db)
		await priority_svc.increment_rapid_actions(user_id)
		
		# Idempotent join (upsert_waitlist handles its own commit)
		await upsert_waitlist(self.db, user_id=user_id, drop_id=drop_id)

	async def leave_waitlist(self, user_id: int, drop_id: int) -> None:
		# Track rapid action (every join/leave counts)
		priority_svc = PriorityService(self.db)
		await priority_svc.increment_rapid_actions(user_id)
		
		# Idempotent leave (delete_waitlist handles its own commit)
		await delete_waitlist(self.db, user_id=user_id, drop_id=drop_id)

	async def claim(self, user_id: int, drop_id: int) -> str:
		# Validate drop
		drop_row = await self.db.execute(select(Drop).where(Drop.id == drop_id))
		drop: Drop | None = drop_row.scalar_one_or_none()
		if not drop or not drop.is_active:
			raise ValueError("drop_not_available")
		
		# Check if drop has started
		now = datetime.now(tz=timezone.utc)
		starts_at = drop.starts_at
		if starts_at.tzinfo is None:
			starts_at = starts_at.replace(tzinfo=timezone.utc)
		if starts_at > now:
			raise ValueError("drop_not_started")
		
		# Window check - ensure all datetime objects are timezone-aware
		window_start = drop.claim_window_start
		window_end = drop.claim_window_end
		
		# Ensure timezone-aware for comparison
		if window_start.tzinfo is None:
			window_start = window_start.replace(tzinfo=timezone.utc)
		if window_end.tzinfo is None:
			window_end = window_end.replace(tzinfo=timezone.utc)
		
		if not (window_start <= now <= window_end):
			raise ValueError("claim_window_closed")
		# Idempotent: existing claim -> return code
		existing = await get_claim_by_user_and_drop(self.db, user_id=user_id, drop_id=drop_id)
		if existing:
			return existing.code
		# Ensure user in waitlist
		waitlist_entry = await self.db.execute(
			select(Waitlist).where(Waitlist.user_id == user_id, Waitlist.drop_id == drop_id)
		)
		waitlist_row = waitlist_entry.scalar_one_or_none()
		if waitlist_row is None:
			raise ValueError("not_in_waitlist")
		
		# Priority-based claim: Check if user is in top priority users
		# CRITICAL: Priority check and stock decrement must be atomic to prevent race conditions
		# Strategy: Get priorities, check position, then atomically decrement stock in one transaction
		
		# Refresh drop to get latest stock (critical for concurrent claims)
		await self.db.refresh(drop)
		current_stock = drop.stock
		
		# Get already claimed count for this drop (within same transaction)
		from app.models import Claim
		claimed_res = await self.db.execute(
			select(func.count(Claim.id)).where(Claim.drop_id == drop_id)
		)
		claimed_count = claimed_res.scalar_one() or 0
		
		# Calculate available slots
		available_slots = current_stock - claimed_count
		
		if available_slots <= 0:
			raise ValueError("out_of_stock")
		
		# Get priority rankings (must be done AFTER getting current stock/claimed count)
		priority_svc = PriorityService(self.db)
		priorities = await priority_svc.get_waitlist_with_priorities(drop_id)
		
		# Priority-based claim: Only allow claims from top priority users
		if priorities:
			# Find user's position in priority-sorted waitlist
			user_priority_rank = next((i for i, (uid, _, _) in enumerate(priorities) if uid == user_id), None)
			
			if user_priority_rank is None:
				# User not found in waitlist (shouldn't happen, but safety check)
				raise ValueError("not_in_waitlist")
			
			# Only allow claim if user is in top available_slots by priority
			# user_priority_rank is 0-indexed: rank 0 = 1st place, rank 1 = 2nd place, etc.
			# If available_slots = 1, only rank 0 (1st place) can claim
			# If available_slots = 2, ranks 0 and 1 (1st and 2nd) can claim
			if user_priority_rank >= available_slots:
				# User's priority rank is below available slots threshold
				# Example: available_slots=1, user_priority_rank=2 (3rd place) → cannot claim
				raise ValueError("priority_too_low")
		
		# CRITICAL: Atomically decrement stock AFTER priority check
		# This must be the last check before creating claim record
		# If stock decrement fails, another transaction claimed it first
		updated = await try_decrement_stock(self.db, drop_id=drop_id)
		if not updated:
			# Another transaction claimed the stock between our check and decrement
			# This is a race condition protection - reject this claim
			raise ValueError("out_of_stock")
		
		# Generate single-use code
		code = secrets.token_hex(6)
		claim = await create_claim_record(self.db, user_id=user_id, drop_id=drop_id, code=code)
		return claim.code



