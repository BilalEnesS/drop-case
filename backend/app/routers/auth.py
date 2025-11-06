from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.auth import SignUpRequest, LoginRequest, UserOut, TokenOut
from app.core.security import hash_password, verify_password, create_access_token
from app.repositories.user_repo import get_user_by_email, create_user


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignUpRequest, db: AsyncSession = Depends(get_session)) -> UserOut:
	# Fail if email already exists
	existing = await get_user_by_email(db, payload.email)
	if existing is not None:
		raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email_taken")

	password_hash = hash_password(payload.password)
	user = await create_user(db, payload.email, password_hash)
	return UserOut.model_validate(user)


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_session)) -> TokenOut:
	# Validate credentials
	user = await get_user_by_email(db, payload.email)
	if user is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")
	if not verify_password(payload.password, user.password_hash):
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")

	access_token = create_access_token({"sub": str(user.id), "email": user.email, "role": user.role})
	return TokenOut(access_token=access_token)


