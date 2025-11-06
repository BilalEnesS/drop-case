from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.deps import require_admin
from app.db.session import get_session
from app.models import Drop
from app.schemas.admin import DropCreate, DropUpdate
from app.schemas.drop import DropOut


router = APIRouter(prefix="/admin/drops", tags=["admin"])


@router.get("", response_model=List[DropOut])
async def list_all_drops(_ = Depends(require_admin), db: AsyncSession = Depends(get_session)) -> List[DropOut]:
	# Auto-deactivate expired drops
	from datetime import datetime, timezone
	now = datetime.now(tz=timezone.utc)
	await db.execute(
		update(Drop)
		.where(Drop.claim_window_end < now, Drop.is_active == True)  # noqa: E712
		.values(is_active=False)
	)
	await db.commit()
	# List all drops for admin
	res = await db.execute(select(Drop).order_by(Drop.starts_at.desc()))
	drops = res.scalars().all()
	return [DropOut.model_validate(d) for d in drops]


@router.post("", response_model=DropOut, status_code=status.HTTP_201_CREATED)
async def create_drop(payload: DropCreate, _: None = Depends(require_admin), db: AsyncSession = Depends(get_session)) -> DropOut:
	drop = Drop(
		title=payload.title,
		description=payload.description,
		starts_at=payload.starts_at,
		claim_window_start=payload.claim_window_start,
		claim_window_end=payload.claim_window_end,
		stock=payload.stock,
		is_active=payload.is_active,
	)
	db.add(drop)
	await db.commit()
	await db.refresh(drop)
	return DropOut.model_validate(drop)


@router.put("/{drop_id}", response_model=DropOut)
async def update_drop(drop_id: int, payload: DropUpdate, _: None = Depends(require_admin), db: AsyncSession = Depends(get_session)) -> DropOut:
	res = await db.execute(select(Drop).where(Drop.id == drop_id))
	drop: Drop | None = res.scalar_one_or_none()
	if not drop:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="drop_not_found")
	# Apply partial updates
	for field, value in payload.model_dump(exclude_unset=True).items():
		setattr(drop, field, value)
	await db.commit()
	await db.refresh(drop)
	return DropOut.model_validate(drop)


@router.delete("/{drop_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_drop(drop_id: int, _: None = Depends(require_admin), db: AsyncSession = Depends(get_session)) -> None:
	await db.execute(delete(Drop).where(Drop.id == drop_id))
	await db.commit()
	return None


