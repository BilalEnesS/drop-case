from typing import Sequence

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Drop, Waitlist
from app.repositories.drop_repo import list_active_drops
from app.repositories.waitlist_repo import upsert_waitlist, delete_waitlist
from app.repositories.claim_repo import get_claim_by_user_and_drop, create_claim_record, try_decrement_stock
import secrets
from datetime import datetime, timezone


class DropService:
	def __init__(self, db: AsyncSession) -> None:
		self.db = db

	async def list_active(self, offset: int = 0, limit: int = 20) -> Sequence[Drop]:
		return await list_active_drops(self.db, offset=offset, limit=limit)

	async def join_waitlist(self, user_id: int, drop_id: int) -> None:
		# Ensure drop exists and active
		exists = await self.db.execute(select(Drop.id, Drop.is_active).where(Drop.id == drop_id))
		row = exists.first()
		if row is None or row.is_active is False:
			raise ValueError("drop_not_available")
		# Idempotent join
		await upsert_waitlist(self.db, user_id=user_id, drop_id=drop_id)

	async def leave_waitlist(self, user_id: int, drop_id: int) -> None:
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
		in_waitlist = await self.db.execute(select(Waitlist.id).where(Waitlist.user_id == user_id, Waitlist.drop_id == drop_id))
		if in_waitlist.scalar_one_or_none() is None:
			raise ValueError("not_in_waitlist")
		# Try decrease stock
		updated = await try_decrement_stock(self.db, drop_id=drop_id)
		if not updated:
			raise ValueError("out_of_stock")
		# Generate single-use code
		code = secrets.token_hex(6)
		claim = await create_claim_record(self.db, user_id=user_id, drop_id=drop_id, code=code)
		return claim.code



