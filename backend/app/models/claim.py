from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ClaimStatus(str):
	ISSUED = "issued"
	REDEEMED = "redeemed"
	EXPIRED = "expired"


class Claim(Base):
	__tablename__ = "claims"
	__table_args__ = (
		UniqueConstraint("code", name="uq_claim_code"),
	)

	id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
	drop_id: Mapped[int] = mapped_column(ForeignKey("drops.id", ondelete="CASCADE"), nullable=False, index=True)
	code: Mapped[str] = mapped_column(String(24), nullable=False)
	status: Mapped[str] = mapped_column(Enum(ClaimStatus.ISSUED, ClaimStatus.REDEEMED, ClaimStatus.EXPIRED, name="claim_status"), default=ClaimStatus.ISSUED, nullable=False)
	claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


