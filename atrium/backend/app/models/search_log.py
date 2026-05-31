"""Search logs: power demand sensing and analytics."""
import uuid
from datetime import datetime
from sqlalchemy import Integer, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class SearchLog(Base):
    __tablename__ = "search_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    raw_query: Mapped[str] = mapped_column(Text, nullable=False)
    parsed_intent: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    results_count: Mapped[int] = mapped_column(Integer, default=0)
    booked_asset_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("assets.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
