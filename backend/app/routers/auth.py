from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.schemas.auth import SignUpRequest, LoginRequest, UserOut, TokenOut
from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignUpRequest, db: AsyncSession = Depends(get_session)) -> UserOut:
	service = AuthService(db)
	try:
		return await service.signup(payload.email, payload.password)
	except ValueError as e:
		if str(e) == "email_taken":
			raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="email_taken")
		raise


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_session)) -> TokenOut:
	service = AuthService(db)
	try:
		token = await service.login(payload.email, payload.password)
		return TokenOut(access_token=token)
	except ValueError:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")


