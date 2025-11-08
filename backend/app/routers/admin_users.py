from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel, EmailStr

from app.core.deps import require_admin
from app.core.security import hash_password
from app.db.session import get_session
from app.models import User, UserRole
from app.repositories.user_repo import get_user_by_email, create_user
from app.schemas.auth import UserOut


router = APIRouter(prefix="/admin/users", tags=["admin"])


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    role: str | None = None


@router.get("", response_model=List[UserOut])
async def list_users(
    _ = Depends(require_admin),
    db: AsyncSession = Depends(get_session)
) -> List[UserOut]:
    res = await db.execute(select(User).order_by(User.created_at.desc()))
    users = res.scalars().all()
    return [UserOut.model_validate(u) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user_admin(
    payload: UserCreate,
    _ = Depends(require_admin),
    db: AsyncSession = Depends(get_session)
) -> UserOut:
    existing = await get_user_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email_taken")
    
    if payload.role not in ["user", "admin"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_role")
    
    password_hash = hash_password(payload.password)
    user = await create_user(db, payload.email, password_hash, payload.role)
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.put("/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: int,
    payload: UserUpdate,
    _ = Depends(require_admin),
    db: AsyncSession = Depends(get_session)
) -> UserOut:
    if payload.role not in ["user", "admin"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="invalid_role")
    
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    
    user.role = payload.role
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    _ = Depends(require_admin),
    db: AsyncSession = Depends(get_session)
) -> None:
    from sqlalchemy import delete
    res = await db.execute(select(User).where(User.id == user_id))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()
    return None

