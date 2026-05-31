"""Search and intent schemas."""
from datetime import datetime
from pydantic import BaseModel, Field
from typing import Any


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
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
    asset_id: str
    user_id: str
    start_time: datetime
    end_time: datetime
    purpose: str | None = None
    attendee_count: int | None = None
    is_recurring: bool = False
    recurrence_weeks: int | None = None


class ConfirmRequest(BaseModel):
    user_id: str
    enable_reminders: bool = True


class StaffOverrideRequest(BaseModel):
    booking_id: str
    staff_user_id: str
    reason: str
    details: str
    alternative_asset_id: str | None = None


class AgentTriggerRequest(BaseModel):
    confirmed_booking_id: str
    priority_request_summary: str
    requesting_user_id: str | None = None


class SwapResponseRequest(BaseModel):
    booking_id: str
    user_id: str
    accept: bool
