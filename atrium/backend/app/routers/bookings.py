"""Bookings router."""
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.search import HoldRequest, ConfirmRequest, SwapResponseRequest, RescheduleRequest
from app.services.booking_service import BookingService
from app.services.reminder_service import ReminderService, generate_ics
from app.models.booking import Booking
from app.models.asset import Asset
from app.models.user import User

router = APIRouter(prefix="/api/bookings", tags=["bookings"])
logger = logging.getLogger("hillingone.bookings")


@router.get("")
async def list_user_bookings(
    page: int = 1,
    page_size: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List bookings for the authenticated user. Upcoming always returned in full; past paginated."""
    page_size = min(page_size, 50)
    offset = (page - 1) * page_size

    # Always return all upcoming bookings regardless of pagination
    upcoming_result = await db.execute(
        select(Booking, Asset)
        .outerjoin(Asset, Asset.id == Booking.asset_id)
        .where(
            Booking.user_id == current_user.id,
            Booking.state.in_(["confirmed", "held", "swap_pending"]),
        )
        .order_by(Booking.start_time.asc())
    )
    upcoming = [
        {**b.to_dict(), "asset": a.to_dict() if a else None}
        for b, a in upcoming_result.all()
    ]

    # Paginate past bookings
    past_result = await db.execute(
        select(Booking, Asset)
        .outerjoin(Asset, Asset.id == Booking.asset_id)
        .where(
            Booking.user_id == current_user.id,
            Booking.state.in_(["cancelled", "completed"]),
        )
        .order_by(Booking.start_time.desc())
        .offset(offset)
        .limit(page_size + 1)
    )
    past_rows = past_result.all()
    has_more = len(past_rows) > page_size
    past = [
        {**b.to_dict(), "asset": a.to_dict() if a else None}
        for b, a in past_rows[:page_size]
    ]

    return {"upcoming": upcoming, "past": past, "page": page, "has_more": has_more}


@router.post("/hold")
async def hold(
    req: HoldRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = BookingService(db)
    try:
        booking = await svc.create_held_booking(
            asset_id=req.asset_id,
            user_id=str(current_user.id),
            start=req.start_time,
            end=req.end_time,
            purpose=req.purpose,
            attendee_count=req.attendee_count,
            is_recurring=req.is_recurring,
            recurrence_weeks=req.recurrence_weeks,
        )
        logger.info("hold_created booking_id=%s user_id=%s", str(booking.id), str(current_user.id))
        return booking.to_dict()
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/{booking_id}/confirm")
async def confirm(
    booking_id: str,
    req: ConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = BookingService(db)
    try:
        booking = await svc.confirm_booking(booking_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    response = booking.to_dict()
    if req.enable_reminders:
        rsvc = ReminderService(db)
        reminders = await rsvc.schedule_for_booking(booking)
        response["reminders_scheduled"] = len(reminders)
        if reminders:
            response["encouragement"] = reminders[0].encouragement
    logger.info("booking_confirmed booking_id=%s user_id=%s", booking_id, str(current_user.id))
    return response


@router.delete("/{booking_id}")
async def cancel_user(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a booking. Automatically refunds any Stripe payment."""
    svc = BookingService(db)
    try:
        booking = await svc.user_cancel(booking_id, str(current_user.id))
    except ValueError as e:
        code = 403 if str(e) == "not_booking_owner" else 400
        raise HTTPException(status_code=code, detail=str(e))

    refund_info = None
    if settings.stripe_secret_key:
        try:
            import asyncio
            import stripe as _stripe
            from sqlalchemy import select as _select
            from app.models.payment import Payment

            _stripe.api_key = settings.stripe_secret_key
            result = await db.execute(
                _select(Payment).where(
                    Payment.booking_id == uuid.UUID(booking_id),
                    Payment.status == "succeeded",
                )
            )
            payment = result.scalar_one_or_none()
            if payment:
                refund = await asyncio.to_thread(
                    _stripe.Refund.create,
                    payment_intent=payment.stripe_payment_intent_id,
                )
                payment.status = "refunded"
                payment.refund_id = refund.id
                await db.commit()
                refund_info = {"refunded": True, "amount": f"£{payment.amount_pence / 100:.2f}"}
        except Exception as exc:
            logger.error("refund_error booking_id=%s err=%s", booking_id, str(exc))
            refund_info = {"refunded": False, "message": "Cancellation processed; refund requires manual review."}

    result = booking.to_dict()
    if refund_info:
        result["refund"] = refund_info
    return result


@router.patch("/{booking_id}/reschedule")
async def reschedule_booking(
    booking_id: str,
    req: RescheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = BookingService(db)
    try:
        booking = await svc.reschedule(booking_id, str(current_user.id), req.start_time, req.end_time)
        return booking.to_dict()
    except ValueError as e:
        code = 409 if str(e) == "slot_unavailable" else 400
        raise HTTPException(status_code=code, detail=str(e))


@router.post("/{booking_id}/swap-accept")
async def swap_accept(
    booking_id: str,
    req: SwapResponseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = BookingService(db)
    try:
        return await svc.accept_swap(booking_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{booking_id}/swap-decline")
async def swap_decline(
    booking_id: str,
    req: SwapResponseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = BookingService(db)
    try:
        booking = await svc.decline_swap(booking_id, str(current_user.id))
        return {"booking": booking.to_dict(), "message": "Booking remains confirmed. Staff alerted to seek alternative."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{booking_id}/ics")
async def calendar_invite(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if str(booking.user_id) != str(current_user.id) and current_user.role not in ("staff", "councillor", "admin"):
        raise HTTPException(status_code=403, detail="Not authorised to access this booking")
    asset = await db.get(Asset, booking.asset_id)
    user = await db.get(User, booking.user_id)
    ics_bytes = generate_ics(booking, asset, user)
    return Response(
        content=ics_bytes,
        media_type="text/calendar",
        headers={
            "Content-Disposition": f'attachment; filename="hillingone-{booking.reference}.ics"'
        },
    )


@router.get("/{booking_id}")
async def get_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    if str(booking.user_id) != str(current_user.id) and current_user.role not in ("staff", "councillor", "admin"):
        raise HTTPException(status_code=403, detail="Not authorised to access this booking")
    asset = await db.get(Asset, booking.asset_id)
    user = await db.get(User, booking.user_id)
    return {
        "booking": booking.to_dict(),
        "asset": asset.to_dict() if asset else None,
        "user": user.to_dict() if user else None,
    }
