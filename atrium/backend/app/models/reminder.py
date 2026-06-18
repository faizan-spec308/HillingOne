"""Reminder model: scheduled reminders for upcoming bookings.

Supports the new feature you requested: residents and staff get encouraging
reminders before their bookings, with calendar invite generation.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, ForeignKey, Text
from app.db_types import GUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    booking_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("bookings.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("users.id"), nullable=False)
    remind_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="in_app")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    encouragement: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "booking_id": str(self.booking_id),
            "user_id": str(self.user_id),
            "remind_at": self.remind_at.isoformat(),
            "channel": self.channel,
            "message": self.message,
            "encouragement": self.encouragement,
            "sent": self.sent,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
        }
