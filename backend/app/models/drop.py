from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Drop(Base):
	__tablename__ = "drops"

	id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
	title: Mapped[str] = mapped_column(String(200), nullable=False)
	description: Mapped[str | None] = mapped_column(Text, nullable=True)
	starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
	claim_window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
	claim_window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
	stock: Mapped[int] = mapped_column(Integer, nullable=False)
	is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


