from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models import Booking
from app.schemas import BookingCreate, BookingStatusUpdate
from app.services.booking_service import (
    cancel_booking,
    create_booking,
    update_booking_status,
)
from typing import Optional

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _serialize(b: Booking) -> dict:
    return {
        "id": b.id,
        "reference": b.reference,
        "user_id": b.user_id,
        "user_name": b.user.name if b.user else None,
        "facility_id": b.facility_id,
        "facility_name": b.facility.name if b.facility else None,
        "facility_location": b.facility.location if b.facility else None,
        "time_slot_id": b.time_slot_id,
        "slot_date": b.time_slot.slot_date.isoformat() if b.time_slot else None,
        "start_time": b.time_slot.start_time.strftime("%H:%M") if b.time_slot else None,
        "end_time": b.time_slot.end_time.strftime("%H:%M") if b.time_slot else None,
        "status": b.status,
        "notes": b.notes,
        "ai_suggested": b.ai_suggested,
        "ai_confidence": float(b.ai_confidence) if b.ai_confidence else None,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


def _load_bookings(db: Session, query):
    return (
        query.options(
            joinedload(Booking.facility),
            joinedload(Booking.time_slot),
            joinedload(Booking.user),
        )
        .order_by(Booking.created_at.desc())
        .all()
    )


# /all must be declared BEFORE /{booking_id}
@router.get("/all")
def get_all_bookings(
    status: Optional[str] = None,
    facility_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Staff dashboard: return all bookings with optional filters.

    Filter by `status` (confirmed | pending | cancelled) and/or `facility_id`.
    Results are ordered newest first and include full denormalised detail:
    user name, facility name and location, date, time, AI suggestion flag,
    and AI confidence score.
    """
    q = db.query(Booking)
    if status:
        q = q.filter(Booking.status == status)
    if facility_id:
        q = q.filter(Booking.facility_id == facility_id)
    return [_serialize(b) for b in _load_bookings(db, q)]


@router.get("")
def get_user_bookings(user_id: int = Query(..., description="ID of the resident"), db: Session = Depends(get_db)):
    """Return all bookings for a specific resident, ordered newest first."""
    q = db.query(Booking).filter(Booking.user_id == user_id)
    return [_serialize(b) for b in _load_bookings(db, q)]


@router.post("", status_code=201)
def create_new_booking(data: BookingCreate, db: Session = Depends(get_db)):
    """
    Create a booking and atomically lock the time slot.

    Validates that the slot belongs to the specified facility, is still available,
    and the user exists. On success, marks the slot as unavailable and returns
    the full booking record including a unique reference (HBC-2026-XXXX format).
    Returns 400 if the slot is already taken or the facility/slot mismatch.
    """
    try:
        booking = create_booking(db, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    # Reload with relationships for full response
    db.refresh(booking)
    full = (
        db.query(Booking)
        .options(
            joinedload(Booking.facility),
            joinedload(Booking.time_slot),
            joinedload(Booking.user),
        )
        .filter(Booking.id == booking.id)
        .first()
    )
    return _serialize(full)


@router.patch("/{booking_id}")
def update_status(
    booking_id: int, data: BookingStatusUpdate, db: Session = Depends(get_db)
):
    """
    Update booking status.

    Allowed transitions: `pending` → `confirmed`, any → `cancelled`.
    Cancelling a booking automatically restores the time slot to available.
    Reinstating a previously cancelled booking re-locks the slot.
    Returns 400 if the booking or transition is invalid.
    """
    try:
        booking = update_booking_status(db, booking_id, data.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"id": booking.id, "reference": booking.reference, "status": booking.status}


@router.delete("/{booking_id}")
def cancel(booking_id: int, db: Session = Depends(get_db)):
    """Cancel a booking and release the time slot back to the available pool."""
    try:
        booking = cancel_booking(db, booking_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "id": booking.id,
        "reference": booking.reference,
        "status": booking.status,
        "message": "Booking cancelled and slot restored",
    }
