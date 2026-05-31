import datetime
from sqlalchemy.orm import Session
from app.models import Booking, TimeSlot
from app.utils.helpers import generate_unique_reference


def create_booking(db: Session, data) -> Booking:
    slot = db.query(TimeSlot).filter(
        TimeSlot.id == data.time_slot_id,
        TimeSlot.is_available == True,
    ).first()
    if not slot:
        raise ValueError("Time slot is not available")
    if slot.facility_id != data.facility_id:
        raise ValueError("Slot does not belong to this facility")

    reference = generate_unique_reference(db)
    booking = Booking(
        reference=reference,
        user_id=data.user_id,
        facility_id=data.facility_id,
        time_slot_id=data.time_slot_id,
        status="confirmed",
        notes=data.notes,
        ai_suggested=data.ai_suggested or False,
        ai_confidence=data.ai_confidence,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(booking)
    slot.is_available = False
    db.commit()
    db.refresh(booking)
    return booking


def cancel_booking(db: Session, booking_id: int) -> Booking:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise ValueError("Booking not found")
    if booking.status == "cancelled":
        raise ValueError("Booking is already cancelled")

    booking.status = "cancelled"
    slot = db.query(TimeSlot).filter(TimeSlot.id == booking.time_slot_id).first()
    if slot:
        slot.is_available = True
    db.commit()
    db.refresh(booking)
    return booking


def update_booking_status(db: Session, booking_id: int, status: str) -> Booking:
    valid = {"confirmed", "pending", "cancelled"}
    if status not in valid:
        raise ValueError(f"Status must be one of: {', '.join(valid)}")

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise ValueError("Booking not found")

    old_status = booking.status
    booking.status = status

    slot = db.query(TimeSlot).filter(TimeSlot.id == booking.time_slot_id).first()
    if slot:
        if status == "cancelled" and old_status != "cancelled":
            slot.is_available = True
        elif old_status == "cancelled" and status != "cancelled":
            slot.is_available = False

    db.commit()
    db.refresh(booking)
    return booking
