from typing import Optional, Set

from sqlalchemy import Select, and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Claim, ClaimStatus, Drop


async def get_claim_by_user_and_drop(db: AsyncSession, user_id: int, drop_id: int) -> Optional[Claim]:
	stmt: Select = select(Claim).where(Claim.user_id == user_id, Claim.drop_id == drop_id)
	res = await db.execute(stmt)
	return res.scalar_one_or_none()


async def create_claim_record(db: AsyncSession, user_id: int, drop_id: int, code: str) -> Claim:
	claim = Claim(user_id=user_id, drop_id=drop_id, code=code, status=ClaimStatus.ISSUED)
	db.add(claim)
	await db.commit()
	await db.refresh(claim)
	return claim


async def try_decrement_stock(db: AsyncSession, drop_id: int) -> bool:
	# Atomically decrement stock if > 0; return True if updated
	stmt = (
		update(Drop)
		.where(and_(Drop.id == drop_id, Drop.stock > 0))
		.values(stock=Drop.stock - 1)
		.execution_options(synchronize_session=False)
	)
	res = await db.execute(stmt)
	await db.commit()
	return res.rowcount == 1


async def get_user_claimed_drop_ids(db: AsyncSession, user_id: int) -> Set[int]:
	# Return set of drop_ids already claimed by user
	res = await db.execute(select(Claim.drop_id).where(Claim.user_id == user_id))
	return set(r[0] for r in res.all())


