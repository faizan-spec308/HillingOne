"""Demo controller router: pre-loaded scenarios for the hackathon pitch.

Each endpoint runs a complete scenario end-to-end so the demo plays out
flawlessly in front of judges. No manual clicking required.
"""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.user import User
from app.models.asset import Asset
from app.models.booking import Booking
from app.services.booking_service import BookingService
from app.agents.conflict_agent import ConflictResolutionAgent

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db)):
    stmt = select(User)
    result = await db.execute(stmt)
    return [u.to_dict() for u in result.scalars().all()]


@router.post("/scenario/agent-swap-request")
async def scenario_agent_swap(db: AsyncSession = Depends(get_db)):
    """Scenario: a councillor needs a Confirmed slot. Agent runs autonomously.

    1. Find a confirmed resident booking
    2. Trigger the Conflict Resolution Agent
    3. Return the agent's full reasoning trace
    """
    stmt = select(Booking).where(Booking.state == "confirmed").limit(1)
    booking = (await db.execute(stmt)).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="No confirmed bookings available for demo")

    asset = await db.get(Asset, booking.asset_id)
    priority_summary = (
        f"Cllr Smith requires {asset.name} for an urgent constituency surgery "
        f"on {booking.start_time.strftime('%A %d %B at %H:%M')}. The same time as "
        f"this confirmed booking. Please find a comparable alternative for the "
        f"resident and respect their right to decline."
    )

    agent = ConflictResolutionAgent(db)
    result = await agent.resolve(
        confirmed_booking_id=str(booking.id),
        priority_request_summary=priority_summary,
    )
    return {
        "scenario": "agent_swap_request",
        "original_booking_id": str(booking.id),
        "original_asset": asset.to_dict(),
        "priority_request": priority_summary,
        "agent_result": result,
    }


@router.post("/scenario/legitimate-override")
async def scenario_override(db: AsyncSession = Depends(get_db)):
    """Scenario: a flooded room must be cancelled by staff with full transparency.

    1. Find a confirmed booking
    2. Find a staff user
    3. Find a comparable alternative
    4. Execute the override with reason 'room_damage'
    """
    stmt = select(Booking).where(Booking.state == "confirmed").limit(1)
    booking = (await db.execute(stmt)).scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="No confirmed bookings available")

    staff_stmt = select(User).where(User.role == "staff").limit(1)
    staff = (await db.execute(staff_stmt)).scalar_one_or_none()
    if not staff:
        raise HTTPException(status_code=404, detail="No staff user found")

    asset = await db.get(Asset, booking.asset_id)
    # Find an alternative same ward
    alt_stmt = select(Asset).where(
        Asset.ward == asset.ward,
        Asset.id != asset.id,
        Asset.capacity >= (booking.attendee_count or 0),
    ).limit(1)
    alt = (await db.execute(alt_stmt)).scalar_one_or_none()

    svc = BookingService(db)
    result = await svc.staff_override(
        booking_id=str(booking.id),
        staff_user_id=str(staff.id),
        reason="room_damage",
        details=(
            "Burst pipe in the ceiling overnight has caused water damage to the "
            "main hall. The space is unsafe to use until repairs are completed "
            "by the contractor on Friday. We are contacting all affected bookings "
            "immediately with a comparable alternative venue and applying a "
            "20 percent goodwill credit."
        ),
        alternative_asset_id=str(alt.id) if alt else None,
    )
    return {
        "scenario": "legitimate_override",
        "original_booking": booking.to_dict(),
        "original_asset": asset.to_dict(),
        "alternative": alt.to_dict() if alt else None,
        "override_result": result,
    }


@router.post("/reset")
async def reset_demo(db: AsyncSession = Depends(get_db)):
    """Reset all demo state by reverting any swap_pending and re-confirming."""
    stmt = select(Booking).where(Booking.state == "swap_pending")
    result = await db.execute(stmt)
    for b in result.scalars().all():
        b.state = "confirmed"
        b.alternative_offered_id = None
        b.swap_message = None
    await db.commit()
    return {"reset": True}
