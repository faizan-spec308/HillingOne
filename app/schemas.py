from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import date, time
from decimal import Decimal


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None


# ── Facility ──────────────────────────────────────────────────────────────────

class FacilityListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category_id: int
    location: Optional[str] = None
    capacity: Optional[int] = None
    hourly_rate: Optional[Decimal] = None
    amenities: Optional[List[str]] = None
    accessibility: Optional[bool] = None
    parking: Optional[bool] = None
    category: Optional[CategoryResponse] = None


class FacilityResponse(FacilityListResponse):
    address: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


# ── TimeSlot ──────────────────────────────────────────────────────────────────

class TimeSlotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    facility_id: int
    slot_date: date
    start_time: time
    end_time: time
    is_available: bool


# ── User ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    name: str = Field(..., examples=["Jane Smith"])
    email: Optional[str] = Field(None, examples=["jane.smith@example.com"])
    phone: Optional[str] = Field(None, examples=["07700 900000"])
    role: Optional[str] = Field("resident", description="One of: resident | staff | admin")
    department: Optional[str] = Field(None, examples=["Housing"])


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
    department: Optional[str] = None


# ── Booking ───────────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    user_id: int = Field(..., examples=[5])
    facility_id: int = Field(..., examples=[3])
    time_slot_id: int = Field(..., examples=[123])
    notes: Optional[str] = Field(None, examples=["Birthday party for 60 guests"])
    ai_suggested: Optional[bool] = Field(False, description="True if this booking originated from the AI agent")
    ai_confidence: Optional[float] = Field(None, ge=0, le=100, examples=[94.5])


class BookingStatusUpdate(BaseModel):
    status: str = Field(
        ...,
        examples=["confirmed"],
        description="New status for the booking. One of: confirmed | pending | cancelled",
    )


# ── AI Agent ──────────────────────────────────────────────────────────────────

class AISearchRequest(BaseModel):
    query: str = Field(
        ...,
        description="Free-text description of what the resident needs",
        examples=["I need a hall in Hayes for 80 people with parking for a birthday party"],
    )
    user_id: Optional[int] = Field(None, examples=[5])


class AIBookRequest(BaseModel):
    query: str = Field(
        ...,
        description="Natural language booking request including facility, date, and time preference",
        examples=["Book Hayes Community Hall next Saturday afternoon for a community meeting"],
    )
    user_id: int = Field(..., examples=[5])
