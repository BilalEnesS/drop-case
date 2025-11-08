from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
	# Fetch a single user by email
	stmt = select(User).where(User.email == email)
	res = await db.execute(stmt)
	return res.scalar_one_or_none()


async def create_user(db: AsyncSession, email: str, password_hash: str, role: str = "user") -> User:
	# Insert a new user
	from datetime import datetime, timezone
	user = User(
		email=email, 
		password_hash=password_hash,
		role=role,
		created_at=datetime.now(tz=timezone.utc)
	)
	db.add(user)
	await db.flush()  # Get ID without committing
	await db.refresh(user)
	return user


