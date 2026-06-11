"""Single source of truth for booking prices.

Free assets cost nothing — no demo fees, no surprises. Paid assets are
charged per occurrence (hourly rate x duration), with a £1 Stripe minimum.
"""
from datetime import datetime

from app.models.asset import Asset

STRIPE_MINIMUM_PENCE = 100


def occurrence_amount_pence(asset: Asset | None, start: datetime, end: datetime) -> int:
    """Price of a single booking occurrence in pence. 0 for free assets."""
    if asset and asset.hourly_rate and float(asset.hourly_rate) > 0:
        hours = (end - start).total_seconds() / 3600
        return max(STRIPE_MINIMUM_PENCE, int(float(asset.hourly_rate) * hours * 100))
    return 0


def booking_total_pence(asset: Asset | None, booking) -> int:
    """Total due for a booking, including all recurring occurrences."""
    per_occurrence = occurrence_amount_pence(asset, booking.start_time, booking.end_time)
    occurrences = 1
    if booking.is_recurring and booking.recurrence_pattern:
        occurrences = max(1, len(booking.recurrence_pattern.get("occurrences", [])) or 1)
    return per_occurrence * occurrences
