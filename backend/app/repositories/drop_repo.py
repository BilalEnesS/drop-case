from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Drop


async def list_active_drops(db: AsyncSession, offset: int = 0, limit: int = 20) -> Sequence[Drop]:
	stmt = (
		select(Drop)
		.where(Drop.is_active == True)  # noqa: E712
		.order_by(Drop.starts_at.desc())
		.offset(offset)
		.limit(limit)
	)
	res = await db.execute(stmt)
	return list(res.scalars().all())


