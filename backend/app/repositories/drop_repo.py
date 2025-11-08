from typing import Sequence
from datetime import datetime

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


async def create_drop(
	db: AsyncSession,
	title: str,
	description: str | None,
	starts_at: datetime,
	claim_window_start: datetime,
	claim_window_end: datetime,
	stock: int,
	is_active: bool = True
) -> Drop:
	# Create a new drop
	drop = Drop(
		title=title,
		description=description,
		starts_at=starts_at,
		claim_window_start=claim_window_start,
		claim_window_end=claim_window_end,
		stock=stock,
		is_active=is_active
	)
	db.add(drop)
	await db.flush()  # Get ID without committing
	await db.refresh(drop)
	return drop


