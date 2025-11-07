from typing import Set

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Waitlist


async def upsert_waitlist(db: AsyncSession, user_id: int, drop_id: int) -> None:
	# Idempotent join using unique constraint; insert if not exists
	# Check if already exists first (more reliable for SQLite)
	exists = await db.execute(select(Waitlist.id).where(Waitlist.user_id == user_id, Waitlist.drop_id == drop_id))
	if exists.scalar_one_or_none() is None:
		# Not in waitlist, insert
		stmt = insert(Waitlist).values(user_id=user_id, drop_id=drop_id)
		await db.execute(stmt)
	# If already exists, do nothing (idempotent)


async def delete_waitlist(db: AsyncSession, user_id: int, drop_id: int) -> None:
	# Idempotent leave; delete if exists (no error if not exists)
	await db.execute(delete(Waitlist).where(Waitlist.user_id == user_id, Waitlist.drop_id == drop_id))


async def get_user_waitlist_drop_ids(db: AsyncSession, user_id: int) -> Set[int]:
	# Return set of drop_ids user joined
	res = await db.execute(select(Waitlist.drop_id).where(Waitlist.user_id == user_id))
	return set(r[0] for r in res.all())


