from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Waitlist(Base):
	__tablename__ = "waitlist"
	__table_args__ = (
		UniqueConstraint("user_id", "drop_id", name="uq_waitlist_user_drop"),
	)

	id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
	drop_id: Mapped[int] = mapped_column(ForeignKey("drops.id", ondelete="CASCADE"), nullable=False, index=True)
	joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


