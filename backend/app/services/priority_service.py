from datetime import datetime, timezone
from typing import Dict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.models import User, Drop, Waitlist


class PriorityService:
	def __init__(self, db: AsyncSession) -> None:
		self.db = db
		self.A = settings.PRIORITY_COEFF_A
		self.B = settings.PRIORITY_COEFF_B
		self.C = settings.PRIORITY_COEFF_C

	async def calculate_priority_score(
		self, 
		user: User, 
		drop: Drop, 
		joined_at: datetime
	) -> int:
		# Base score (can be adjusted)
		base = 100
		
		# signup_latency_ms: How fast user signed up after drop started (ms)
		# If user signed up before drop started, use 0
		# Ensure both are timezone-aware for comparison
		user_created = user.created_at
		drop_starts = drop.starts_at
		if user_created.tzinfo is None:
			user_created = user_created.replace(tzinfo=timezone.utc)
		if drop_starts.tzinfo is None:
			drop_starts = drop_starts.replace(tzinfo=timezone.utc)
		
		if user_created > drop_starts:
			signup_latency_ms = int((user_created - drop_starts).total_seconds() * 1000)
		else:
			signup_latency_ms = 0
		
		# account_age_days: Account age in days
		now = datetime.now(tz=timezone.utc)
		user_created = user.created_at
		if user_created.tzinfo is None:
			user_created = user_created.replace(tzinfo=timezone.utc)
		account_age_days = int((now - user_created).total_seconds() / 86400)
		
		# rapid_actions: Already tracked in user.rapid_actions
		rapid_actions = user.rapid_actions
		
		# Calculate priority score
		priority_score = (
			base 
			+ (signup_latency_ms % self.A) 
			+ (account_age_days % self.B) 
			- (rapid_actions % self.C)
		)
		
		return priority_score

	async def get_waitlist_with_priorities(self, drop_id: int) -> list[tuple[int, int, datetime]]:
		# Get all users in waitlist with their priority scores
		# Returns: list of (user_id, priority_score, joined_at) sorted by priority (desc)
		
		# Get waitlist entries
		waitlist_res = await self.db.execute(
			select(Waitlist.user_id, Waitlist.joined_at)
			.where(Waitlist.drop_id == drop_id)
		)
		waitlist_entries = waitlist_res.all()
		
		if not waitlist_entries:
			return []
		
		# Get drop
		drop_res = await self.db.execute(select(Drop).where(Drop.id == drop_id))
		drop = drop_res.scalar_one_or_none()
		if not drop:
			return []
		
		# Get all users
		user_ids = [entry.user_id for entry in waitlist_entries]
		users_res = await self.db.execute(select(User).where(User.id.in_(user_ids)))
		users = {u.id: u for u in users_res.scalars().all()}
		
		# Calculate priority scores
		priorities = []
		for entry in waitlist_entries:
			user = users.get(entry.user_id)
			if not user:
				continue
			score = await self.calculate_priority_score(user, drop, entry.joined_at)
			priorities.append((entry.user_id, score, entry.joined_at))
		
		# Sort by priority score (desc), then by joined_at (asc) as tiebreaker
		priorities.sort(key=lambda x: (-x[1], x[2]))
		
		return priorities

	async def increment_rapid_actions(self, user_id: int) -> None:
		# Increment rapid_actions counter for user
		# Note: Does not commit - caller should handle transaction
		from sqlalchemy import update
		await self.db.execute(
			update(User)
			.where(User.id == user_id)
			.values(rapid_actions=User.rapid_actions + 1)
		)

