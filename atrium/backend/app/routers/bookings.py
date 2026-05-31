"""Bookings router."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.search import HoldRequest, ConfirmRequest, SwapResponseRequest
from app.services.booking_service import BookingService
from app.services.reminder_service import ReminderService, generate_ics
from app.models.booking import Booking
from app.models.asset import Asset
from app.models.user import User

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.post("/hold")
async def hold(req: HoldRequest, db: AsyncSession = Depends(get_db)):
    svc = BookingService(db)
    try:
        booking = await svc.create_held_booking(
            asset_id=req.asset_id,
            user_id=req.user_id,
            start=req.start_time,
            end=req.end_time,
            purpose=req.purpose,
            attendee_count=req.attendee_count,
            is_recurring=req.is_recurring,
            recurrence_weeks=req.recurrence_weeks,
        )
        return booking.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{booking_id}/confirm")
async def confirm(booking_id: str, req: ConfirmRequest, db: AsyncSession = Depends(get_db)):
    svc = BookingService(db)
    try:
        booking = await svc.confirm_booking(booking_id, req.user_id)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    response = booking.to_dict()
    if req.enable_reminders:
        rsvc = ReminderService(db)
        reminders = await rsvc.schedule_for_booking(booking)
        response["reminders_scheduled"] = len(reminders)
        if reminders:
            response["encouragement"] = reminders[0].encouragement
    return response


@router.delete("/{booking_id}")
async def cancel_user(booking_id: str, user_id: str, db: AsyncSession = Depends(get_db)):
    svc = BookingService(db)
    try:
        booking = await svc.user_cancel(booking_id, user_id)
        return booking.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{booking_id}/swap-accept")
async def swap_accept(booking_id: str, req: SwapResponseRequest, db: AsyncSession = Depends(get_db)):
    svc = BookingService(db)
    try:
        return await svc.accept_swap(booking_id, req.user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{booking_id}/swap-decline")
async def swap_decline(booking_id: str, req: SwapResponseRequest, db: AsyncSession = Depends(get_db)):
    svc = BookingService(db)
    try:
        booking = await svc.decline_swap(booking_id, req.user_id)
        return {"booking": booking.to_dict(), "message": "Booking remains confirmed. Staff alerted to seek alternative."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{booking_id}/ics")
async def calendar_invite(booking_id: str, db: AsyncSession = Depends(get_db)):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    asset = await db.get(Asset, booking.asset_id)
    user = await db.get(User, booking.user_id)
    ics_bytes = generate_ics(booking, asset, user)
    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="atrium-{booking.reference}.ics"'
        },
    )


@router.get("/{booking_id}")
async def get_booking(booking_id: str, db: AsyncSession = Depends(get_db)):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    asset = await db.get(Asset, booking.asset_id)
    user = await db.get(User, booking.user_id)
    return {
        "booking": booking.to_dict(),
        "asset": asset.to_dict() if asset else None,
        "user": user.to_dict() if user else None,
    }
