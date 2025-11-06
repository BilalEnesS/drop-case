from typing import Sequence

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import Drop, Waitlist
from app.repositories.drop_repo import list_active_drops
from app.repositories.waitlist_repo import upsert_waitlist, delete_waitlist


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



