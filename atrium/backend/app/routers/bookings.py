"""Bookings router."""
import asyncio
import uuid
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.search import HoldRequest, ConfirmRequest, SwapResponseRequest, RescheduleRequest
from app.services.booking_service import BookingService, _now
from app.services.pricing import booking_total_pence, occurrence_amount_pence
from app.services.reminder_service import ReminderService, generate_ics
from app.services.email_service import (
    send_email,
    booking_confirmed_html,
    booking_cancelled_html,
    booking_rescheduled_html,
)
from app.models.booking import Booking
from app.models.asset import Asset
from app.models.payment import Payment
from app.models.user import User

router = APIRouter(prefix="/api/bookings", tags=["bookings"])
logger = logging.getLogger("hillingone.bookings")


@router.get("")
async def list_user_bookings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List bookings for the authenticated user. Upcoming always returned in full; past paginated."""
    page_size = min(page_size, 50)
    offset = (page - 1) * page_size

    # Lazily sweep finished bookings into "completed" so they never linger
    # in the Upcoming list (background loop also does this periodically).
    # Decouple commit from the read — a transient DB hiccup here should not
    # prevent the user from seeing their bookings.
    try:
        await db.execute(
            update(Booking)
            .where(
                Booking.user_id == current_user.id,
                Booking.state == "confirmed",
                Booking.end_time < _now(),
            )
            .values(state="completed")
        )
        await db.commit()
    except Exception:
        await db.rollback()
        logger.warning("completion_sweep_failed user_id=%s", str(current_user.id))

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

    # Attach the proposed alternative venue to swap_pending bookings so the
    # resident can make an informed accept/decline decision.
    alt_ids = {b["alternative_offered_id"] for b in upcoming if b["state"] == "swap_pending" and b["alternative_offered_id"]}
    if alt_ids:
        alt_result = await db.execute(select(Asset).where(Asset.id.in_(alt_ids)))
        alt_map = {str(a.id): a.to_dict() for a in alt_result.scalars().all()}
        for b in upcoming:
            if b["state"] == "swap_pending" and b["alternative_offered_id"]:
                b["alternative"] = alt_map.get(b["alternative_offered_id"])

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
            asset_id=str(req.asset_id),
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
    booking_pre = await db.get(Booking, booking_id)
    if not booking_pre:
        raise HTTPException(status_code=404, detail="booking_not_found")
    if str(booking_pre.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="not_booking_owner")

    # Paid bookings must have a succeeded payment before they can be confirmed —
    # the client cannot skip the payment step by calling this endpoint directly.
    # If the webhook hasn't landed yet, verify the intent with Stripe directly.
    if booking_pre.state == "held" and settings.stripe_secret_key:
        pre_asset = await db.get(Asset, booking_pre.asset_id)
        if booking_total_pence(pre_asset, booking_pre) > 0:
            pay_result = await db.execute(
                select(Payment).where(
                    Payment.booking_id == uuid.UUID(booking_id),
                    Payment.status == "succeeded",
                )
            )
            paid = pay_result.scalar_one_or_none() is not None
            if not paid:
                import stripe as _stripe
                _stripe.api_key = settings.stripe_secret_key
                pending_result = await db.execute(
                    select(Payment).where(
                        Payment.booking_id == uuid.UUID(booking_id),
                        Payment.status == "pending",
                    )
                )
                all_pending = pending_result.scalars().all()
                for pending in all_pending:
                    try:
                        intent = await asyncio.to_thread(
                            _stripe.PaymentIntent.retrieve, pending.stripe_payment_intent_id
                        )
                    except Exception as exc:
                        logger.error("intent_verify_failed booking_id=%s err=%s", booking_id, str(exc))
                        continue
                    if intent.status == "succeeded" and not paid:
                        pending.status = "succeeded"
                        pending.stripe_charge_id = intent.get("latest_charge") or ""
                        paid = True
                    elif not paid:
                        # Superseded by a later successful payment attempt
                        pending.status = "cancelled"
                if paid:
                    await db.commit()
            if not paid:
                raise HTTPException(status_code=402, detail="payment_required")

    svc = BookingService(db)
    try:
        booking = await svc.confirm_booking(booking_id, str(current_user.id))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    response = booking.to_dict()
    if booking.is_recurring and booking.recurrence_pattern:
        response["recurring_confirmed"] = len(booking.recurrence_pattern.get("occurrences", []))
    if req.enable_reminders:
        rsvc = ReminderService(db)
        reminders = await rsvc.schedule_for_booking(booking)
        response["reminders_scheduled"] = len(reminders)
        if reminders:
            response["encouragement"] = reminders[0].encouragement
    logger.info("booking_confirmed booking_id=%s user_id=%s", booking_id, str(current_user.id))

    asset = await db.get(Asset, booking.asset_id)
    asyncio.create_task(send_email(
        to=current_user.email,
        subject=f"Booking confirmed — {asset.name if asset else 'HillingOne'}",
        html=booking_confirmed_html(current_user.name, booking, asset),
    ))

    return response


@router.delete("/{booking_id}")
async def cancel_user(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a booking. Refund is 50% if within 24h of start, otherwise full."""
    # Check the 24h window before cancelling so we can apply the right refund
    booking_pre = await db.get(Booking, booking_id)
    if not booking_pre:
        raise HTTPException(status_code=404, detail="booking_not_found")
    late_cancel = _now() >= booking_pre.start_time - timedelta(hours=24)

    svc = BookingService(db)
    try:
        booking = await svc.user_cancel(booking_id, str(current_user.id))
    except ValueError as e:
        code = 403 if str(e) == "not_booking_owner" else 400
        raise HTTPException(status_code=code, detail=str(e))

    refund_info = None
    if settings.stripe_secret_key:
        try:
            import stripe as _stripe

            _stripe.api_key = settings.stripe_secret_key
            # Recurring occurrences share one payment held against the parent
            # booking — refund this occurrence's share, not the whole payment.
            payment_booking_id = uuid.UUID(
                str(booking_pre.parent_booking_id) if booking_pre.parent_booking_id else booking_id
            )
            result = await db.execute(
                select(Payment).where(
                    Payment.booking_id == payment_booking_id,
                    Payment.status == "succeeded",
                ).with_for_update()
            )
            payment = result.scalar_one_or_none()
            if payment:
                # Only child occurrences (with a parent) get a per-occurrence refund.
                # The parent booking holds the full payment; cancelling it refunds all remaining.
                is_recurring_share = bool(booking_pre.parent_booking_id)
                if is_recurring_share:
                    cancel_asset_pre = await db.get(Asset, booking.asset_id)
                    base = occurrence_amount_pence(cancel_asset_pre, booking.start_time, booking.end_time)
                else:
                    base = payment.amount_pence
                refund_pence = min(base // 2 if late_cancel else base, payment.amount_pence)
                if refund_pence > 0:
                    refund = await asyncio.to_thread(
                        _stripe.Refund.create,
                        payment_intent=payment.stripe_payment_intent_id,
                        amount=refund_pence,
                    )
                    payment.amount_pence -= refund_pence
                    payment.refund_id = refund.id
                    if payment.amount_pence <= 0 or not is_recurring_share:
                        payment.status = "refunded"
                    await db.commit()
                    refund_info = {
                        "refunded": True,
                        "amount": f"£{refund_pence / 100:.2f}",
                        "partial": late_cancel,
                    }
        except Exception as exc:
            logger.error("refund_error booking_id=%s err=%s", booking_id, str(exc))
            refund_info = {"refunded": False, "message": "Cancellation processed; refund requires manual review."}

    result = booking.to_dict()
    if refund_info:
        result["refund"] = refund_info

    cancel_asset = await db.get(Asset, booking.asset_id)
    asyncio.create_task(send_email(
        to=current_user.email,
        subject="Your HillingOne booking has been cancelled",
        html=booking_cancelled_html(
            current_user.name, booking, cancel_asset,
            refund_info.get("amount") if refund_info else None,
            late_cancel=late_cancel,
        ),
    ))

    return result


@router.patch("/{booking_id}/reschedule")
async def reschedule_booking(
    booking_id: str,
    req: RescheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Reschedule a booking. Handles price difference: upcharge via Stripe intent, refund via partial refund."""
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="booking_not_found")
    if str(booking.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="not_booking_owner")
    if booking.state not in ("confirmed", "held"):
        raise HTTPException(status_code=409, detail="cannot_reschedule")

    # 24-hour cutoff — cannot change within 24h of the booking start
    if _now() >= booking.start_time - timedelta(hours=24):
        raise HTTPException(status_code=400, detail="reschedule_too_late")

    new_start = req.start_time.replace(tzinfo=None) if req.start_time.tzinfo else req.start_time
    new_end   = req.end_time.replace(tzinfo=None)   if req.end_time.tzinfo   else req.end_time

    asset      = await db.get(Asset, booking.asset_id)
    orig_pence = occurrence_amount_pence(asset, booking.start_time, booking.end_time)
    new_pence  = occurrence_amount_pence(asset, new_start, new_end)
    diff_pence = new_pence - orig_pence

    # ── Upcharge: need to collect more money before rescheduling ────────────
    if diff_pence > 0 and settings.stripe_secret_key:
        import stripe as _stripe
        _stripe.api_key = settings.stripe_secret_key
        intent = await asyncio.to_thread(
            _stripe.PaymentIntent.create,
            amount=diff_pence,
            currency="gbp",
            metadata={
                "booking_id":  booking_id,
                "type":        "reschedule_upcharge",
                "new_start":   new_start.isoformat(),
                "new_end":     new_end.isoformat(),
            },
            description=f"HillingOne reschedule — {asset.name if asset else booking_id}",
        )
        return {
            "requires_payment": True,
            "client_secret":    intent.client_secret,
            "payment_intent_id": intent.id,
            "amount_pence":     diff_pence,
            "amount_display":   f"£{diff_pence / 100:.2f}",
        }

    # ── Partial refund: duration shortened ──────────────────────────────────
    refund_display = None
    if diff_pence < 0 and settings.stripe_secret_key:
        refund_pence = abs(diff_pence)
        pay_result = await db.execute(
            select(Payment).where(
                Payment.booking_id == uuid.UUID(booking_id),
                Payment.status == "succeeded",
            )
        )
        payment = pay_result.scalar_one_or_none()
        if payment:
            try:
                import stripe as _stripe
                _stripe.api_key = settings.stripe_secret_key
                cap = min(refund_pence, payment.amount_pence)
                await asyncio.to_thread(
                    _stripe.Refund.create,
                    payment_intent=payment.stripe_payment_intent_id,
                    amount=cap,
                )
                payment.amount_pence -= cap
                await db.commit()
                refund_display = f"£{cap / 100:.2f}"
                logger.info("partial_refund booking_id=%s amount_pence=%d", booking_id, cap)
            except Exception as exc:
                logger.error("partial_refund_error booking_id=%s err=%s", booking_id, str(exc))

    # ── Do the actual reschedule ─────────────────────────────────────────────
    svc = BookingService(db)
    try:
        booking = await svc.reschedule(booking_id, str(current_user.id), new_start, new_end)
    except ValueError as e:
        code = 409 if str(e) == "slot_unavailable" else 400
        raise HTTPException(status_code=code, detail=str(e))

    result = {**booking.to_dict(), "asset": asset.to_dict() if asset else None}
    if refund_display:
        result["refunded"] = True
        result["refund_amount"] = refund_display

    asyncio.create_task(send_email(
        to=current_user.email,
        subject=f"Booking rescheduled — {asset.name if asset else 'HillingOne'}",
        html=booking_rescheduled_html(current_user.name, booking, asset, refund_display),
    ))

    return result


class RescheduleConfirmRequest(BaseModel):
    payment_intent_id: str = Field(..., min_length=1, max_length=100)
    new_start: datetime
    new_end: datetime


@router.post("/{booking_id}/reschedule-confirm")
async def reschedule_confirm(
    booking_id: str,
    req: RescheduleConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Called after Stripe payment for a reschedule upcharge succeeds on the client."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    import stripe as _stripe
    _stripe.api_key = settings.stripe_secret_key

    intent = await asyncio.to_thread(_stripe.PaymentIntent.retrieve, req.payment_intent_id)
    if intent.status != "succeeded":
        raise HTTPException(status_code=402, detail="Payment has not been completed")
    if intent.metadata.get("booking_id") != booking_id:
        raise HTTPException(status_code=403, detail="Payment intent does not match this booking")
    if intent.metadata.get("type") != "reschedule_upcharge":
        raise HTTPException(status_code=403, detail="Payment intent is not a reschedule upcharge")

    new_start = req.new_start.replace(tzinfo=None) if req.new_start.tzinfo else req.new_start
    new_end   = req.new_end.replace(tzinfo=None)   if req.new_end.tzinfo   else req.new_end

    svc = BookingService(db)
    try:
        booking = await svc.reschedule(booking_id, str(current_user.id), new_start, new_end)
    except ValueError as e:
        # The user has already paid the upcharge — refund it automatically
        # rather than keeping money for a reschedule that didn't happen.
        try:
            await asyncio.to_thread(_stripe.Refund.create, payment_intent=req.payment_intent_id)
            logger.info("reschedule_failed_auto_refund booking_id=%s pi=%s", booking_id, req.payment_intent_id)
            detail = "slot_unavailable_payment_refunded" if str(e) == "slot_unavailable" else str(e)
        except Exception as refund_exc:
            logger.error("reschedule_refund_failed booking_id=%s err=%s", booking_id, str(refund_exc))
            detail = str(e)
        code = 409 if str(e) == "slot_unavailable" else 400
        raise HTTPException(status_code=code, detail=detail)

    # Record the additional payment
    asset = await db.get(Asset, booking.asset_id)
    db.add(Payment(
        id=uuid.uuid4(),
        booking_id=uuid.UUID(booking_id),
        stripe_payment_intent_id=req.payment_intent_id,
        amount_pence=intent.amount,
        currency="gbp",
        status="succeeded",
        stripe_charge_id=intent.get("latest_charge") or "",
    ))
    await db.commit()
    await db.refresh(booking)

    logger.info("reschedule_confirm booking_id=%s pi=%s", booking_id, req.payment_intent_id)

    asyncio.create_task(send_email(
        to=current_user.email,
        subject=f"Booking rescheduled — {asset.name if asset else 'HillingOne'}",
        html=booking_rescheduled_html(current_user.name, booking, asset),
    ))

    return {**booking.to_dict(), "asset": asset.to_dict() if asset else None}


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
