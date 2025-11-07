from datetime import datetime, timezone
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
	# Auto-deactivate expired drops - fetch and check in Python to avoid timezone issues
	from app.services.drop_service import DropService
	service = DropService(db)
	await service._auto_deactivate_expired()
	
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


@router.post("/suggest-description")
async def suggest_description(
	payload: dict,
	_: None = Depends(require_admin),
) -> dict:
	# AI-powered description suggestion
	from app.services.ai_service import suggest_drop_description
	title = payload.get("title", "")
	if not title:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="title_required")
	
	description = await suggest_drop_description(title)
	return {"description": description}


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


@router.get("/{drop_id}/waitlist")
async def get_drop_waitlist(
	drop_id: int,
	_: None = Depends(require_admin),
	db: AsyncSession = Depends(get_session),
) -> dict:
	# Get waitlist for a drop with priority scores and rankings
	from app.services.priority_service import PriorityService
	from app.models import User, Drop
	
	# Verify drop exists
	drop_res = await db.execute(select(Drop).where(Drop.id == drop_id))
	drop = drop_res.scalar_one_or_none()
	if not drop:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="drop_not_found")
	
	# Get priorities
	priority_svc = PriorityService(db)
	priorities = await priority_svc.get_waitlist_with_priorities(drop_id)
	
	# Get user details
	user_ids = [uid for uid, _, _ in priorities]
	users_res = await db.execute(select(User).where(User.id.in_(user_ids)))
	users = {u.id: u for u in users_res.scalars().all()}
	
	# Build response
	waitlist_data = []
	for rank, (user_id, score, joined_at) in enumerate(priorities, start=1):
		user = users.get(user_id)
		if not user:
			continue
		now = datetime.now(tz=timezone.utc)
		account_age_days = int((now - user.created_at).total_seconds() / 86400) if user.created_at else 0
		
		waitlist_data.append({
			"rank": rank,
			"user_id": user_id,
			"email": user.email,
			"priority_score": score,
			"joined_at": joined_at.isoformat(),
			"account_age_days": account_age_days,
			"rapid_actions": user.rapid_actions,
		})
	
	return {
		"drop_id": drop_id,
		"drop_title": drop.title,
		"stock": drop.stock,
		"waitlist_count": len(waitlist_data),
		"waitlist": waitlist_data,
	}


