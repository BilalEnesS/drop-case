from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import get_cache, set_cache, invalidate_cache, make_cache_key_from_params
from app.core.deps import get_current_user, get_optional_user
from app.db.session import get_session
from app.schemas.drop import DropOut, DropListItem
from app.services.drop_service import DropService


router = APIRouter(prefix="/drops", tags=["drops"])


@router.get("", response_model=List[DropListItem])
async def list_drops(
	offset: int = Query(0, ge=0),
	limit: int = Query(20, ge=1, le=100),
	db: AsyncSession = Depends(get_session),
	user = Depends(get_optional_user),
) -> List[DropListItem]:
	# Try to get from cache (only for non-authenticated users)
	cache_key = None
	if user is None:
		cache_key = make_cache_key_from_params("drops_list", offset=offset, limit=limit)
		cached = await get_cache(cache_key)
		if cached is not None:
			return cached
	
	service = DropService(db)
	drops = await service.list_active(offset=offset, limit=limit)
	if user is None:
		result = [DropListItem(**DropOut.model_validate(d).model_dump(), joined=False, claimed=False) for d in drops]
		# Cache for 30 seconds
		if cache_key:
			await set_cache(cache_key, result, ttl=30)
		return result
	# compute joined set
	from app.repositories.waitlist_repo import get_user_waitlist_drop_ids
	from app.repositories.claim_repo import get_user_claimed_drop_ids, get_claim_by_user_and_drop
	joined_ids = await get_user_waitlist_drop_ids(db, user_id=user.id)
	claimed_ids = await get_user_claimed_drop_ids(db, user_id=user.id)
	items: List[DropListItem] = []
	for d in drops:
		base = DropOut.model_validate(d).model_dump()
		is_claimed = d.id in claimed_ids
		claim_code = None
		if is_claimed:
			claim = await get_claim_by_user_and_drop(db, user_id=user.id, drop_id=d.id)
			claim_code = claim.code if claim else None
		items.append(DropListItem(**base, joined=(d.id in joined_ids), claimed=is_claimed, claim_code=claim_code))
	return items


@router.post("/{drop_id}/join", status_code=status.HTTP_204_NO_CONTENT)
async def join_waitlist(
	drop_id: int,
	request: Request,
	user = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
) -> None:
	# Admin users cannot join waitlist
	if user.role == "admin":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_cannot_join")
	
	# Rate limiting
	from app.core.rate_limit import rate_limit
	await rate_limit(request, limit=20, window=60, key_prefix="drop_join", user_id=user.id)
	
	service = DropService(db)
	try:
		await service.join_waitlist(user_id=user.id, drop_id=drop_id)
		# Invalidate cache for drops list
		await invalidate_cache("drops_list:*")
		await db.commit()
	except ValueError as e:
		await db.rollback()
		error_msg = str(e)
		if error_msg == "drop_not_available":
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="drop_not_available")
		if error_msg == "drop_not_started":
			raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="drop_not_started")
		raise


@router.post("/{drop_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_waitlist(
	drop_id: int,
	request: Request,
	user = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
) -> None:
	# Admin users cannot leave waitlist
	if user.role == "admin":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_cannot_leave")
	
	# Rate limiting
	from app.core.rate_limit import rate_limit
	await rate_limit(request, limit=20, window=60, key_prefix="drop_leave", user_id=user.id)
	
	service = DropService(db)
	try:
		await service.leave_waitlist(user_id=user.id, drop_id=drop_id)
		# Invalidate cache for drops list
		await invalidate_cache("drops_list:*")
		await db.commit()
	except Exception:
		await db.rollback()
		raise


@router.post("/{drop_id}/claim")
async def claim(
	drop_id: int,
	request: Request,
	user = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
):
	# Admin users cannot claim drops
	if user.role == "admin":
		raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin_cannot_claim")
	
	# Rate limiting
	from app.core.rate_limit import rate_limit
	await rate_limit(request, limit=5, window=60, key_prefix="drop_claim", user_id=user.id)
	
	service = DropService(db)
	try:
		code = await service.claim(user_id=user.id, drop_id=drop_id)
		await db.commit()
		return {"code": code}
	except ValueError as e:
		await db.rollback()
		m = str(e)
		if m == "drop_not_available":
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=m)
		if m == "drop_not_started":
			raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=m)
		if m == "claim_window_closed":
			raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=m)
		if m == "not_in_waitlist":
			raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=m)
		if m == "out_of_stock":
			raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=m)
		if m == "priority_too_low":
			raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=m)
		raise
	except Exception:
		await db.rollback()
		raise


@router.get("/claimed", response_model=List[DropListItem])
async def list_claimed_drops(
	user = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
) -> List[DropListItem]:
	# Admin users cannot view claimed drops (admin only manages, doesn't participate)
	if user.role == "admin":
		return []
	
	# Return all drops user has claimed (active or inactive) with codes
	from app.repositories.claim_repo import get_claim_by_user_and_drop
	from app.models import Claim, Drop
	from sqlalchemy import select
	
	# Get all claims for this user
	claims_res = await db.execute(select(Claim).where(Claim.user_id == user.id))
	claims = claims_res.scalars().all()
	
	if not claims:
		return []
	
	# Get corresponding drops
	drop_ids = [c.drop_id for c in claims]
	drops_res = await db.execute(select(Drop).where(Drop.id.in_(drop_ids)).order_by(Drop.starts_at.desc()))
	drops = drops_res.scalars().all()
	
	# Build response with claim codes
	items: List[DropListItem] = []
	claim_map = {c.drop_id: c.code for c in claims}
	for d in drops:
		base = DropOut.model_validate(d).model_dump()
		items.append(DropListItem(**base, joined=False, claimed=True, claim_code=claim_map.get(d.id)))
	return items


