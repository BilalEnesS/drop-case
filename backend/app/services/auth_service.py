from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password, create_access_token
from app.repositories.user_repo import get_user_by_email, create_user
from app.schemas.auth import UserOut


class AuthService:
	def __init__(self, db: AsyncSession) -> None:
		self.db = db

	async def signup(self, email: str, password: str):
		# Return User object (SQLAlchemy model) instead of UserOut
		# This allows the router to commit and refresh before converting to UserOut
		existing = await get_user_by_email(self.db, email)
		if existing is not None:
			raise ValueError("email_taken")
		password_hash = hash_password(password)
		user = await create_user(self.db, email, password_hash)
		return user

	async def login(self, email: str, password: str) -> str:
		user = await get_user_by_email(self.db, email)
		if user is None or not verify_password(password, user.password_hash):
			raise ValueError("invalid_credentials")
		return create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})


