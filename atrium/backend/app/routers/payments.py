"""Payments router — Stripe PaymentIntent creation, webhook handling, and refunds."""
import asyncio
import json
import uuid
import logging
import stripe
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_staff
from app.models.payment import Payment
from app.models.booking import Booking
from app.models.asset import Asset
from app.models.user import User
from sqlalchemy import func
from app.services.pricing import booking_total_pence, occurrence_amount_pence

router = APIRouter(prefix="/api/payments", tags=["payments"])
logger = logging.getLogger("hillingone.payments")


def _get_stripe():
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured on this server.")
    stripe.api_key = settings.stripe_secret_key
    return stripe


@router.post("/create-intent")
async def create_payment_intent(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a Stripe PaymentIntent for a held booking owned by the authenticated user.

    Free venues never reach Stripe — the response tells the client to confirm directly.
    Recurring bookings are charged for every secured occurrence up front.
    """
    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if str(booking.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised for this booking.")
    if booking.state != "held":
        raise HTTPException(status_code=409, detail="Only held bookings can be paid for.")

    asset = await db.get(Asset, booking.asset_id)

    # For recurring bookings, charge only for the occurrences that are actually
    # still held/confirmed — not the count frozen in recurrence_pattern JSON,
    # which may be stale if siblings expired before payment was collected.
    if booking.is_recurring and booking.recurrence_pattern:
        sibling_count_result = await db.execute(
            select(func.count()).where(
                Booking.parent_booking_id == booking.id,
                Booking.state.in_(["held", "confirmed"]),
            )
        )
        live_siblings = sibling_count_result.scalar() or 0
        per_occ = occurrence_amount_pence(asset, booking.start_time, booking.end_time)
        amount = per_occ * (1 + live_siblings)
    else:
        amount = booking_total_pence(asset, booking)

    if amount == 0:
        return {"free": True, "amount_pence": 0, "amount_display": "Free"}

    s = _get_stripe()
    intent = await asyncio.to_thread(
        s.PaymentIntent.create,
        amount=amount,
        currency="gbp",
        metadata={
            "booking_id": str(booking_id),
            "reference": booking.reference or "",
            "asset": asset.name if asset else "",
        },
        description=f"HillingOne — {asset.name if asset else booking_id}",
    )

    payment = Payment(
        id=uuid.uuid4(),
        booking_id=uuid.UUID(str(booking_id)),
        stripe_payment_intent_id=intent.id,
        amount_pence=amount,
        currency="gbp",
        status="pending",
    )
    db.add(payment)
    await db.commit()

    return {
        "client_secret": intent.client_secret,
        "payment_intent_id": intent.id,
        "amount_pence": amount,
        "amount_display": f"£{amount / 100:.2f}",
    }


@router.post("/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle incoming Stripe webhook events. Signature verification is mandatory."""
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=400, detail="Webhook secret not configured on this server.")

    s = _get_stripe()
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        event = s.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
    except Exception as exc:
        logger.warning("webhook_signature_failed err=%s", str(exc))
        raise HTTPException(status_code=400, detail=str(exc))

    intent_obj = event["data"]["object"]

    if event["type"] == "payment_intent.succeeded":
        await _on_payment_succeeded(intent_obj, db, s)
    elif event["type"] == "payment_intent.payment_failed":
        await _on_payment_failed(intent_obj, db)

    return {"received": True}


async def _on_payment_succeeded(intent: dict, db: AsyncSession, s) -> None:
    result = await db.execute(
        select(Payment).where(Payment.stripe_payment_intent_id == intent["id"])
    )
    payment = result.scalar_one_or_none()
    if not payment:
        return

    payment.status = "succeeded"
    payment.stripe_charge_id = intent.get("latest_charge") or ""
    payment.updated_at = datetime.utcnow()

    booking = await db.get(Booking, payment.booking_id)
    if booking and booking.state == "held":
        booking.state = "confirmed"
        booking.confirmed_at = datetime.utcnow()
        # Confirm held weekly occurrences tied to this booking as well
        siblings = await db.execute(
            select(Booking).where(
                Booking.parent_booking_id == booking.id,
                Booking.state == "held",
            )
        )
        for sib in siblings.scalars().all():
            sib.state = "confirmed"
            sib.confirmed_at = datetime.utcnow()
        logger.info("payment_succeeded_confirmed booking_id=%s", str(booking.id))
    elif booking and booking.state != "held":
        # Hold expired before payment completed — refund immediately
        logger.warning(
            "payment_succeeded_but_hold_expired booking_id=%s state=%s — issuing refund",
            str(booking.id), booking.state,
        )
        try:
            await asyncio.to_thread(s.Refund.create, payment_intent=intent["id"])
            payment.status = "refunded"
        except Exception as exc:
            logger.error("auto_refund_failed booking_id=%s err=%s", str(booking.id), str(exc))

    await db.commit()


async def _on_payment_failed(intent: dict, db: AsyncSession) -> None:
    result = await db.execute(
        select(Payment).where(Payment.stripe_payment_intent_id == intent["id"])
    )
    payment = result.scalar_one_or_none()
    if payment:
        payment.status = "failed"
        payment.updated_at = datetime.utcnow()
        await db.commit()


@router.post("/refund/{booking_id}")
async def refund_booking(
    booking_id: str,
    db: AsyncSession = Depends(get_db),
    current_staff: User = Depends(require_staff),
):
    """Issue a full Stripe refund for a booking. Staff only."""
    s = _get_stripe()

    result = await db.execute(
        select(Payment).where(
            Payment.booking_id == uuid.UUID(booking_id),
            Payment.status == "succeeded",
        )
    )
    payment = result.scalar_one_or_none()

    if not payment:
        return {"refunded": False, "message": "No completed payment found for this booking."}

    refund = await asyncio.to_thread(
        s.Refund.create, payment_intent=payment.stripe_payment_intent_id
    )
    payment.status = "refunded"
    payment.refund_id = refund.id
    payment.updated_at = datetime.utcnow()
    await db.commit()

    logger.info("refund_issued booking_id=%s staff_id=%s amount=%d", booking_id, str(current_staff.id), payment.amount_pence)
    return {
        "refunded": True,
        "refund_id": refund.id,
        "amount_refunded": f"£{payment.amount_pence / 100:.2f}",
    }
