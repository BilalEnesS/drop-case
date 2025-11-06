from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_session
from app.repositories.user_repo import get_user_by_email


bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
	creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
	db: AsyncSession = Depends(get_session),
):
	# Decode token and fetch user
	try:
		payload = decode_access_token(creds.credentials)
	except Exception:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")
	email = payload.get("email")
	if not email:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token")
	user = await get_user_by_email(db, email)
	if user is None:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_not_found")
	return user


optional_bearer = HTTPBearer(auto_error=False)


async def get_optional_user(
	creds: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer),
	db: AsyncSession = Depends(get_session),
):
	# Return user or None if no/invalid token
	if not creds:
		return None
	try:
		payload = decode_access_token(creds.credentials)
	except Exception:
		return None
	email = payload.get("email")
	if not email:
		return None
	user = await get_user_by_email(db, email)
	return user


