from typing import Set

from sqlalchemy import delete, insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Waitlist


async def upsert_waitlist(db: AsyncSession, user_id: int, drop_id: int) -> None:
	# Idempotent join using unique constraint; insert if not exists
	stmt = insert(Waitlist).values(user_id=user_id, drop_id=drop_id)
	# On conflict do nothing (SQLite lacks, but Postgres supports); fallback: check-then-insert
	try:
		await db.execute(stmt)
		await db.commit()
	except Exception:
		# Fallback to check existence and ignore if present
		await db.rollback()
		exists = await db.execute(select(Waitlist.id).where(Waitlist.user_id == user_id, Waitlist.drop_id == drop_id))
		if exists.scalar_one_or_none() is None:
			await db.execute(insert(Waitlist).values(user_id=user_id, drop_id=drop_id))
			await db.commit()


async def delete_waitlist(db: AsyncSession, user_id: int, drop_id: int) -> None:
	# Idempotent leave; delete if exists
	await db.execute(delete(Waitlist).where(Waitlist.user_id == user_id, Waitlist.drop_id == drop_id))
	await db.commit()


async def get_user_waitlist_drop_ids(db: AsyncSession, user_id: int) -> Set[int]:
	# Return set of drop_ids user joined
	res = await db.execute(select(Waitlist.drop_id).where(Waitlist.user_id == user_id))
	return set(r[0] for r in res.all())


