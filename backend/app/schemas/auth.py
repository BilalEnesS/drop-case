from pydantic import BaseModel, EmailStr, Field


class SignUpRequest(BaseModel):
	email: EmailStr
	password: str = Field(min_length=8)


class LoginRequest(BaseModel):
	email: EmailStr
	password: str


class UserOut(BaseModel):
	id: int
	email: EmailStr
	role: str

	class Config:
		from_attributes = True


class TokenOut(BaseModel):
	access_token: str
	token_type: str = "bearer"
	role: str | None = None


