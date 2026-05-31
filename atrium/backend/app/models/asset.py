"""Asset model: bookable council resources (rooms, halls, equipment, outdoor spaces)."""
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Integer, DateTime, Boolean, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    ward: Mapped[str] = mapped_column(String(100), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    accessibility: Mapped[dict] = mapped_column(JSONB, default=dict)
    amenities: Mapped[dict] = mapped_column(JSONB, default=dict)
    hourly_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0"))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6), nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    co2_per_visit: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0.5"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": str(self.id),
            "name": self.name,
            "category": self.category,
            "ward": self.ward,
            "capacity": self.capacity,
            "description": self.description,
            "accessibility": self.accessibility or {},
            "amenities": self.amenities or {},
            "hourly_rate": float(self.hourly_rate),
            "latitude": float(self.latitude) if self.latitude else None,
            "longitude": float(self.longitude) if self.longitude else None,
            "image_url": self.image_url,
            "co2_per_visit": float(self.co2_per_visit),
            "is_active": self.is_active,
        }
