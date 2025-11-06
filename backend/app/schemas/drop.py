from datetime import datetime
from pydantic import BaseModel


class DropOut(BaseModel):
	id: int
	title: str
	description: str | None = None
	starts_at: datetime
	claim_window_start: datetime
	claim_window_end: datetime
	stock: int
	is_active: bool

	class Config:
		from_attributes = True


class DropListItem(DropOut):
	joined: bool = False
	claimed: bool = False
	claim_code: str | None = None


