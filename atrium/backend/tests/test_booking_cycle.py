"""Cycle 1 & 2: hold → confirm, conflict prevention, hold expiry, cancel + notify."""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.services.booking_service import BookingService
from app.models.reminder import Reminder


async def test_hold_then_confirm(db, make):
    user = await make.user(db)
    asset = await make.asset(db)
    svc = BookingService(db)
    start = datetime.utcnow() + timedelta(days=2)
    end = start + timedelta(hours=2)

    held = await svc.create_held_booking(str(asset.id), str(user.id), start, end, attendee_count=10)
    assert held.state == "held"

    confirmed = await svc.confirm_booking(str(held.id), str(user.id))
    assert confirmed.state == "confirmed"
    assert confirmed.confirmed_at is not None


async def test_overlapping_hold_is_blocked(db, make):
    user = await make.user(db)
    asset = await make.asset(db)
    svc = BookingService(db)
    start = datetime.utcnow() + timedelta(days=2)
    end = start + timedelta(hours=2)

    await svc.create_held_booking(str(asset.id), str(user.id), start, end, attendee_count=10)
    with pytest.raises(ValueError, match="slot_unavailable"):
        await svc.create_held_booking(str(asset.id), str(user.id), start, end, attendee_count=10)


async def test_capacity_is_enforced(db, make):
    user = await make.user(db)
    asset = await make.asset(db, capacity=20)
    svc = BookingService(db)
    start = datetime.utcnow() + timedelta(days=2)
    end = start + timedelta(hours=2)
    with pytest.raises(ValueError, match="exceeds_capacity"):
        await svc.create_held_booking(str(asset.id), str(user.id), start, end, attendee_count=50)


async def test_confirm_after_hold_expiry_fails(db, make):
    user = await make.user(db)
    asset = await make.asset(db)
    svc = BookingService(db)
    start = datetime.utcnow() + timedelta(days=2)
    end = start + timedelta(hours=2)
    held = await svc.create_held_booking(str(asset.id), str(user.id), start, end, attendee_count=10)

    held.held_until = datetime.utcnow() - timedelta(minutes=1)
    await db.commit()

    with pytest.raises(ValueError, match="hold_expired"):
        await svc.confirm_booking(str(held.id), str(user.id))


async def test_user_cancel_sets_state_and_notifies(db, make):
    user = await make.user(db)
    asset = await make.asset(db)
    booking = await make.booking(db, asset, user, state="confirmed")
    svc = BookingService(db)

    cancelled = await svc.user_cancel(str(booking.id), str(user.id))
    assert cancelled.state == "cancelled"

    notes = (await db.execute(select(Reminder).where(Reminder.user_id == user.id))).scalars().all()
    assert any(n.channel == "in_app" for n in notes), "resident should get an in-app cancellation notice"


async def test_cannot_cancel_someone_elses_booking(db, make):
    owner = await make.user(db)
    intruder = await make.user(db)
    asset = await make.asset(db)
    booking = await make.booking(db, asset, owner, state="confirmed")
    svc = BookingService(db)
    with pytest.raises(ValueError, match="not_booking_owner"):
        await svc.user_cancel(str(booking.id), str(intruder.id))
