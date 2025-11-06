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
		from datetime import datetime, timezone
		now = datetime.now(tz=timezone.utc)
		await self.db.execute(
			update(Drop)
			.where(Drop.claim_window_end < now, Drop.is_active == True)  # noqa: E712
			.values(is_active=False)
		)
		await self.db.commit()

	async def join_waitlist(self, user_id: int, drop_id: int) -> None:
		# Ensure drop exists and active
		exists = await self.db.execute(select(Drop.id, Drop.is_active).where(Drop.id == drop_id))
		row = exists.first()
		if row is None or row.is_active is False:
			raise ValueError("drop_not_available")
		
		# Track rapid action (every join/leave counts)
		priority_svc = PriorityService(self.db)
		await priority_svc.increment_rapid_actions(user_id)
		
		# Idempotent join
		await upsert_waitlist(self.db, user_id=user_id, drop_id=drop_id)

	async def leave_waitlist(self, user_id: int, drop_id: int) -> None:
		# Track rapid action (every join/leave counts)
		priority_svc = PriorityService(self.db)
		await priority_svc.increment_rapid_actions(user_id)
		
		# Idempotent leave
		await delete_waitlist(self.db, user_id=user_id, drop_id=drop_id)

	async def claim(self, user_id: int, drop_id: int) -> str:
		# Validate drop
		drop_row = await self.db.execute(select(Drop).where(Drop.id == drop_id))
		drop: Drop | None = drop_row.scalar_one_or_none()
		if not drop or not drop.is_active:
			raise ValueError("drop_not_available")
		# Window check
		now = datetime.now(tz=timezone.utc)
		if not (drop.claim_window_start <= now <= drop.claim_window_end):
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
		priority_svc = PriorityService(self.db)
		priorities = await priority_svc.get_waitlist_with_priorities(drop_id)
		
		# Get current stock
		current_stock = drop.stock
		
		# Get already claimed count for this drop
		from app.models import Claim
		claimed_res = await self.db.execute(
			select(func.count(Claim.id)).where(Claim.drop_id == drop_id)
		)
		claimed_count = claimed_res.scalar_one() or 0
		
		# Available slots = stock - claimed_count
		available_slots = current_stock - claimed_count
		
		if available_slots <= 0:
			raise ValueError("out_of_stock")
		
		# Priority-based claim: Only allow claims from top priority users
		# Get top priority user IDs (sorted by priority score descending)
		if priorities:
			# Get top available_slots users by priority
			top_user_ids = {uid for uid, _, _ in priorities[:available_slots]}
			
			# Check user's position in priority list
			user_priority_rank = next((i for i, (uid, _, _) in enumerate(priorities) if uid == user_id), None)
			
			if user_priority_rank is None:
				# User not found in waitlist (shouldn't happen, but safety check)
				raise ValueError("not_in_waitlist")
			
			# Only allow claim if user is in top available_slots by priority
			if user_priority_rank >= available_slots:
				# User's priority rank is below available slots
				# They cannot claim even if stock is available
				raise ValueError("priority_too_low")
		
		# Try decrease stock
		updated = await try_decrement_stock(self.db, drop_id=drop_id)
		if not updated:
			raise ValueError("out_of_stock")
		
		# Generate single-use code
		code = secrets.token_hex(6)
		claim = await create_claim_record(self.db, user_id=user_id, drop_id=drop_id, code=code)
		return claim.code



