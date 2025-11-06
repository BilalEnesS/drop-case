from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

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
	service = DropService(db)
	drops = await service.list_active(offset=offset, limit=limit)
	if user is None:
		return [DropListItem(**DropOut.model_validate(d).model_dump(), joined=False) for d in drops]
	# compute joined set
	from app.repositories.waitlist_repo import get_user_waitlist_drop_ids
	joined_ids = await get_user_waitlist_drop_ids(db, user_id=user.id)
	items: List[DropListItem] = []
	for d in drops:
		base = DropOut.model_validate(d).model_dump()
		items.append(DropListItem(**base, joined=(d.id in joined_ids)))
	return items


@router.post("/{drop_id}/join", status_code=status.HTTP_204_NO_CONTENT)
async def join_waitlist(
	drop_id: int,
	user = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
) -> None:
	service = DropService(db)
	try:
		await service.join_waitlist(user_id=user.id, drop_id=drop_id)
	except ValueError as e:
		if str(e) == "drop_not_available":
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="drop_not_available")
		raise


@router.post("/{drop_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_waitlist(
	drop_id: int,
	user = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
) -> None:
	service = DropService(db)
	await service.leave_waitlist(user_id=user.id, drop_id=drop_id)


