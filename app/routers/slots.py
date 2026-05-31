import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import TimeSlot, Facility
from typing import Optional

router = APIRouter(prefix="/slots", tags=["Slots"])


def _serialize(s: TimeSlot, include_facility: bool = False) -> dict:
    d = {
        "id": s.id,
        "facility_id": s.facility_id,
        "slot_date": s.slot_date.isoformat(),
        "start_time": s.start_time.strftime("%H:%M"),
        "end_time": s.end_time.strftime("%H:%M"),
        "is_available": s.is_available,
    }
    if include_facility and s.facility:
        d["facility_name"] = s.facility.name
        d["facility_location"] = s.facility.location
    return d


@router.get("/available")
def get_available_by_category(
    category_id: int = Query(..., description="Service category ID to search within"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Find all available time slots across a category within a date range.

    Returns slots from today onwards across every active facility in the category.
    Optionally narrow the window with `date_from` and `date_to` (ISO format: YYYY-MM-DD).
    Each slot includes facility name and location — useful for showing residents
    all options across multiple venues in one call.
    """
    q = (
        db.query(TimeSlot)
        .join(Facility)
        .options(joinedload(TimeSlot.facility))
        .filter(
            Facility.category_id == category_id,
            Facility.is_active == True,
            TimeSlot.is_available == True,
            TimeSlot.slot_date >= datetime.date.today(),
        )
    )
    if date_from:
        q = q.filter(TimeSlot.slot_date >= datetime.date.fromisoformat(date_from))
    if date_to:
        q = q.filter(TimeSlot.slot_date <= datetime.date.fromisoformat(date_to))
    slots = q.order_by(TimeSlot.slot_date, TimeSlot.start_time).all()
    return [_serialize(s, include_facility=True) for s in slots]


@router.get("")
def get_slots(
    facility_id: int = Query(..., description="Facility ID to query"),
    date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List available time slots for a specific facility.

    Returns all future available slots ordered by date and time.
    Supply `date` (YYYY-MM-DD) to filter to a single day.
    Returns 400 for an invalid date format.
    """
    q = db.query(TimeSlot).filter(
        TimeSlot.facility_id == facility_id,
        TimeSlot.is_available == True,
        TimeSlot.slot_date >= datetime.date.today(),
    )
    if date:
        try:
            q = q.filter(TimeSlot.slot_date == datetime.date.fromisoformat(date))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format — use YYYY-MM-DD")
    slots = q.order_by(TimeSlot.slot_date, TimeSlot.start_time).all()
    return [_serialize(s) for s in slots]
