"""Payment model — tracks Stripe PaymentIntents and refunds."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=False)
    stripe_payment_intent_id = Column(String(255), unique=True, nullable=False)
    amount_pence = Column(Integer, nullable=False)
    currency = Column(String(10), default="gbp")
    status = Column(String(50), default="pending")  # pending | succeeded | failed | refunded
    stripe_charge_id = Column(String(255), nullable=True)
    refund_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": str(self.id),
            "booking_id": str(self.booking_id),
            "stripe_payment_intent_id": self.stripe_payment_intent_id,
            "amount_pence": self.amount_pence,
            "amount_display": f"£{self.amount_pence / 100:.2f}",
            "currency": self.currency,
            "status": self.status,
            "refund_id": self.refund_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
