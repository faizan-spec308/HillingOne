"""Cycle 4: resident accepts / declines a proposed swap."""
import uuid

import pytest
from sqlalchemy import select

from app.services.booking_service import BookingService
from app.models.user import User
from app.models.payment import Payment
from app.models.reminder import Reminder


async def _swap_pending(db, make, credit=20):
    user = await make.user(db, credits=0)
    original = await make.asset(db, name="Hayes End", ward="Hayes Town")
    alt = await make.asset(db, name="Charville", ward="Hayes Town", capacity=45)
    booking = await make.booking(db, original, user, state="swap_pending", attendees=10)
    booking.alternative_offered_id = alt.id
    booking.swap_message = "Please consider moving."
    booking.goodwill_credit_applied = credit
    await db.commit()
    return user, original, alt, booking


async def test_accept_swap_moves_venue_and_applies_credit(db, make):
    user, original, alt, booking = await _swap_pending(db, make)
    svc = BookingService(db)

    result = await svc.accept_swap(str(booking.id), str(user.id))
    await db.refresh(booking)

    assert booking.state == "cancelled"
    assert result["new_booking"]["state"] == "confirmed"
    assert str(result["new_booking"]["asset_id"]) == str(alt.id)

    refreshed_user = await db.get(User, user.id)
    assert refreshed_user.flexibility_credits == 20

    notes = (await db.execute(select(Reminder).where(Reminder.user_id == user.id))).scalars().all()
    assert len(notes) >= 1


async def test_accept_swap_blocked_if_alternative_taken(db, make):
    user, original, alt, booking = await _swap_pending(db, make)
    other = await make.user(db)
    # Someone grabs the alternative at the same time after the proposal.
    await make.booking(db, alt, other, state="confirmed", start=booking.start_time, end=booking.end_time)
    svc = BookingService(db)

    with pytest.raises(ValueError, match="alternative_no_longer_available"):
        await svc.accept_swap(str(booking.id), str(user.id))
    await db.refresh(booking)
    assert booking.state == "swap_pending", "original booking must be untouched if the swap can't complete"


async def test_accept_swap_carries_payment_to_new_booking(db, make):
    user, original, alt, booking = await _swap_pending(db, make)
    pay = Payment(id=uuid.uuid4(), booking_id=booking.id, stripe_payment_intent_id="pi_test_123",
                  amount_pence=2000, status="succeeded")
    db.add(pay)
    await db.commit()
    svc = BookingService(db)

    result = await svc.accept_swap(str(booking.id), str(user.id))
    moved = await db.get(Payment, pay.id)
    assert str(moved.booking_id) == str(result["new_booking"]["id"]), "payment should follow the resident to the new booking"


async def test_decline_swap_keeps_original(db, make):
    user, original, alt, booking = await _swap_pending(db, make)
    svc = BookingService(db)

    kept = await svc.decline_swap(str(booking.id), str(user.id))
    assert kept.state == "confirmed"
    assert kept.alternative_offered_id is None

    notes = (await db.execute(select(Reminder).where(Reminder.user_id == user.id))).scalars().all()
    assert len(notes) >= 1
