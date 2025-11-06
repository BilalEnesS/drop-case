import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from app.core.config import settings


# Password hashing
def hash_password(plain_password: str) -> str:
	# bcrypt hash
	salt = bcrypt.gensalt(rounds=12)
	return bcrypt.hashpw(plain_password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
	# bcrypt verify
	try:
		return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
	except Exception:
		return False


# JWT helpers
def create_access_token(claims: Dict[str, Any], expires_minutes: int | None = None) -> str:
	# Create signed JWT
	exp_minutes = expires_minutes or settings.JWT_EXPIRE_MINUTES
	exp = datetime.now(tz=timezone.utc) + timedelta(minutes=exp_minutes)
	to_encode = {**claims, "exp": exp}
	token = jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")
	return token


def decode_access_token(token: str) -> Dict[str, Any]:
	# Decode/verify JWT
	return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])  # raises on invalid


