"""Payments router — Stripe PaymentIntent creation, webhook handling, and refunds."""
import json
import uuid
import stripe
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.database import get_db
from app.models.payment import Payment
from app.models.booking import Booking
from app.models.asset import Asset

router = APIRouter(prefix="/api/payments", tags=["payments"])


def _get_stripe():
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured on this server.")
    stripe.api_key = settings.stripe_secret_key
    return stripe


def _calculate_amount_pence(asset: Asset, start_time: datetime, end_time: datetime) -> int:
    """Return amount in pence. Uses hourly_rate if set, otherwise £10 demo fee."""
    if asset and asset.hourly_rate and float(asset.hourly_rate) > 0:
        duration_hours = (end_time - start_time).total_seconds() / 3600
        return max(100, int(float(asset.hourly_rate) * duration_hours * 100))
    return 1000  # £10.00 demo booking fee


@router.post("/create-intent")
async def create_payment_intent(booking_id: str, db: AsyncSession = Depends(get_db)):
    """
    Create a Stripe PaymentIntent for a held booking.

    Returns the client_secret needed by the frontend Stripe Elements form,
    plus the amount in pence and a display string.
    """
    s = _get_stripe()

    booking = await db.get(Booking, booking_id)
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.state != "held":
        raise HTTPException(status_code=409, detail="Only held bookings can be paid for.")

    asset = await db.get(Asset, booking.asset_id)
    amount = _calculate_amount_pence(asset, booking.start_time, booking.end_time)

    intent = s.PaymentIntent.create(
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
    """
    Handle incoming Stripe webhook events.

    Listens for payment_intent.succeeded to auto-confirm bookings,
    and payment_intent.payment_failed to mark payments as failed.
    Verifies the Stripe-Signature header when STRIPE_WEBHOOK_SECRET is set.
    """
    s = _get_stripe()
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")

    try:
        if settings.stripe_webhook_secret:
            event = s.Webhook.construct_event(payload, sig, settings.stripe_webhook_secret)
        else:
            event = json.loads(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    intent_obj = event["data"]["object"]

    if event["type"] == "payment_intent.succeeded":
        await _on_payment_succeeded(intent_obj, db)
    elif event["type"] == "payment_intent.payment_failed":
        await _on_payment_failed(intent_obj, db)

    return {"received": True}


async def _on_payment_succeeded(intent: dict, db: AsyncSession) -> None:
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
async def refund_booking(booking_id: str, db: AsyncSession = Depends(get_db)):
    """
    Issue a full Stripe refund for a booking.

    Looks up the most recent succeeded payment for the booking
    and creates a Stripe refund. Safe to call even if no payment exists.
    """
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

    refund = s.Refund.create(payment_intent=payment.stripe_payment_intent_id)
    payment.status = "refunded"
    payment.refund_id = refund.id
    payment.updated_at = datetime.utcnow()
    await db.commit()

    return {
        "refunded": True,
        "refund_id": refund.id,
        "amount_refunded": f"£{payment.amount_pence / 100:.2f}",
    }
