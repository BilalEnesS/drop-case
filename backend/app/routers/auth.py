from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.rate_limit import create_rate_limit_dependency
from app.db.session import get_session
from app.schemas.auth import SignUpRequest, LoginRequest, UserOut, TokenOut
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def signup(
	payload: SignUpRequest,
	request: Request,
	db: AsyncSession = Depends(get_session),
	_ = Depends(create_rate_limit_dependency(limit=5, window=300, key_prefix="auth_signup"))
) -> UserOut:
	service = AuthService(db)
	try:
		user = await service.signup(payload.email, payload.password)
		await db.commit()
		await db.refresh(user)
		return UserOut.model_validate(user)
	except ValueError as e:
		await db.rollback()
		if str(e) == "email_taken":
			raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email_taken")
		raise
	except Exception:
		await db.rollback()
		raise


@router.post("/login", response_model=TokenOut)
async def login(
	payload: LoginRequest,
	request: Request,
	db: AsyncSession = Depends(get_session),
	_ = Depends(create_rate_limit_dependency(limit=10, window=300, key_prefix="auth_login"))
) -> TokenOut:
	service = AuthService(db)
	try:
		token = await service.login(payload.email, payload.password)
		# Simple role echo: fetch user to include role
		user_out = await service.signup(payload.email, payload.password) if False else None  # placeholder to keep types
		# Better: re-fetch user via service internals; quick approach: AuthService.login could return user too.
		# For now, decode is not safe; re-query:
		from app.repositories.user_repo import get_user_by_email
		user = await get_user_by_email(db, payload.email)
		return TokenOut(access_token=token, role=user.role if user else None)
	except ValueError:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")


