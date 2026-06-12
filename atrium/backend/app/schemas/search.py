"""Search and intent schemas."""
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    user_id: str | None = None
    date_iso: str | None = None


class IntentResponse(BaseModel):
    capacity: int | None = None
    location: str | None = None
    frequency: str | None = None
    day_of_week: str | None = None
    time_of_day: str | None = None
    duration_hours: float | None = None
    accessibility_required: dict[str, bool | None] = Field(default_factory=dict)
    kitchen_required: bool | None = None
    equipment_needed: list[str] = Field(default_factory=list)
    audience_type: str | None = None
    purpose_summary: str = ""
    missing_info: list[str] = Field(default_factory=list)
    follow_up_question: str | None = None
    extracted_summary: str = ""


class AssetMatchResponse(BaseModel):
    asset_id: str
    asset: dict
    rank: int
    match_score: int
    reasoning: str
    carbon_estimate_kg: float
    accessibility_match: str


class SearchResponse(BaseModel):
    intent: IntentResponse
    matches: list[AssetMatchResponse]
    total_inventory_searched: int
    search_log_id: str


class HoldRequest(BaseModel):
    asset_id: UUID
    start_time: datetime
    end_time: datetime
    purpose: str | None = Field(None, max_length=500)
    attendee_count: int | None = Field(None, ge=1, le=10000)
    is_recurring: bool = False
    recurrence_weeks: int | None = Field(None, ge=1, le=52)


class ConfirmRequest(BaseModel):
    enable_reminders: bool = True


class StaffOverrideRequest(BaseModel):
    booking_id: UUID
    reason: str = Field(..., min_length=1, max_length=200)
    details: str = Field(..., min_length=1, max_length=1000)
    alternative_asset_id: UUID | None = None


class AgentTriggerRequest(BaseModel):
    confirmed_booking_id: UUID
    priority_request_summary: str = Field(..., min_length=1, max_length=500)
    requesting_user_id: UUID | None = None


class SwapResponseRequest(BaseModel):
    booking_id: UUID
    accept: bool


class RescheduleRequest(BaseModel):
    start_time: datetime
    end_time: datetime
