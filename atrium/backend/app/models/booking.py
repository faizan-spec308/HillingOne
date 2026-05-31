"""Booking model: the core entity with state machine."""
import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class BookingState(str, enum.Enum):
    OPEN = "open"
    HELD = "held"
    CONFIRMED = "confirmed"
    SWAP_PENDING = "swap_pending"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class CancellationReason(str, enum.Enum):
    USER_CANCELLED = "user_cancelled"
    HOLD_EXPIRED = "hold_expired"
    SWAP_ACCEPTED = "swap_accepted"
    ROOM_DAMAGE = "room_damage"
    SAFETY_ISSUE = "safety_issue"
    MANDATORY_CLOSURE = "mandatory_closure"
    CONTRACTOR_ACCESS = "contractor_access"
    STATUTORY_INSPECTION = "statutory_inspection"
    EMERGENCY_COUNCIL_USE = "emergency_council_use"
    FORCE_MAJEURE = "force_majeure"


VALID_OVERRIDE_REASONS = {
    CancellationReason.ROOM_DAMAGE,
    CancellationReason.SAFETY_ISSUE,
    CancellationReason.MANDATORY_CLOSURE,
    CancellationReason.CONTRACTOR_ACCESS,
    CancellationReason.STATUTORY_INSPECTION,
    CancellationReason.EMERGENCY_COUNCIL_USE,
}

DUAL_APPROVAL_REASONS = {
    CancellationReason.MANDATORY_CLOSURE,
    CancellationReason.EMERGENCY_COUNCIL_USE,
}


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    state: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    attendee_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    recurrence_pattern: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    parent_booking_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    held_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancellation_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cancellation_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancelled_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    alternative_offered_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True)
    goodwill_credit_applied: Mapped[int] = mapped_column(Integer, default=0)
    swap_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "asset_id": str(self.asset_id),
            "user_id": str(self.user_id),
            "state": self.state,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "purpose": self.purpose,
            "attendee_count": self.attendee_count,
            "is_recurring": self.is_recurring,
            "recurrence_pattern": self.recurrence_pattern,
            "held_until": self.held_until.isoformat() if self.held_until else None,
            "confirmed_at": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "cancelled_at": self.cancelled_at.isoformat() if self.cancelled_at else None,
            "cancellation_reason": self.cancellation_reason,
            "cancellation_details": self.cancellation_details,
            "alternative_offered_id": str(self.alternative_offered_id) if self.alternative_offered_id else None,
            "goodwill_credit_applied": self.goodwill_credit_applied,
            "swap_message": self.swap_message,
            "reference": self.reference,
        }
