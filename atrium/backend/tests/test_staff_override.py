"""Cycle 5: Tier-3 staff override (documented cancellation)."""
import pytest
from sqlalchemy import select

from app.services.booking_service import BookingService
from app.models.user import User
from app.models.reminder import Reminder


async def test_override_cancels_credits_and_notifies(db, make):
    staff = await make.user(db, role="staff", ward=None)
    resident = await make.user(db, credits=0)
    asset = await make.asset(db)
    booking = await make.booking(db, asset, resident, state="confirmed")
    svc = BookingService(db)

    result = await svc.staff_override(str(booking.id), str(staff.id),
                                      reason="room_damage", details="Burst pipe; hall unusable.")
    await db.refresh(booking)

    assert booking.state == "cancelled"
    assert booking.cancellation_reason == "room_damage"
    assert result["goodwill_credit_applied"] == 20

    refreshed = await db.get(User, resident.id)
    assert refreshed.flexibility_credits == 20

    notes = (await db.execute(select(Reminder).where(Reminder.user_id == resident.id))).scalars().all()
    assert len(notes) >= 1


async def test_override_rejects_non_operational_reason(db, make):
    staff = await make.user(db, role="staff", ward=None)
    resident = await make.user(db)
    asset = await make.asset(db)
    booking = await make.booking(db, asset, resident, state="confirmed")
    svc = BookingService(db)
    with pytest.raises(ValueError):
        await svc.staff_override(str(booking.id), str(staff.id), reason="user_cancelled", details="x")


async def test_override_requires_staff_role(db, make):
    resident = await make.user(db)
    asset = await make.asset(db)
    booking = await make.booking(db, asset, resident, state="confirmed")
    svc = BookingService(db)
    with pytest.raises(ValueError, match="not_authorised"):
        await svc.staff_override(str(booking.id), str(resident.id), reason="room_damage", details="x")
