from datetime import datetime
from pydantic import BaseModel, Field


class DropCreate(BaseModel):
	title: str = Field(min_length=1, max_length=200)
	description: str | None = None
	starts_at: datetime
	claim_window_start: datetime
	claim_window_end: datetime
	stock: int = Field(ge=0)
	is_active: bool = True


class DropUpdate(BaseModel):
	title: str | None = None
	description: str | None = None
	starts_at: datetime | None = None
	claim_window_start: datetime | None = None
	claim_window_end: datetime | None = None
	stock: int | None = Field(default=None, ge=0)
	is_active: bool | None = None


