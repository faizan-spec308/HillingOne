"""Agent run: stores the full reasoning trace from an autonomous agent execution."""
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_name: Mapped[str] = mapped_column(String(50), nullable=False)
    goal: Mapped[str] = mapped_column(Text, nullable=False)
    steps: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    final_outcome: Mapped[str | None] = mapped_column(String(100), nullable=True)
    related_booking_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("bookings.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "agent_name": self.agent_name,
            "goal": self.goal,
            "steps": self.steps,
            "final_outcome": self.final_outcome,
            "related_booking_id": str(self.related_booking_id) if self.related_booking_id else None,
            "created_at": self.created_at.isoformat(),
        }
