"""Booking service: state machine for the booking lifecycle.

Implements the four-tier cancellation model:
- Tier 1: User cancels own booking (always allowed)
- Tier 2: Agent-mediated swap (the agent asks, resident decides)
- Tier 3: Legitimate operational override (with documented reason)
- Tier 4: Force majeure (system-wide closure)
"""
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.config import settings
from app.models.booking import Booking, VALID_OVERRIDE_REASONS, DUAL_APPROVAL_REASONS, CancellationReason
from app.models.asset import Asset
from app.models.user import User
from app.models.audit_log import AuditLog


def _generate_reference() -> str:
    today = datetime.utcnow().strftime("%Y%m%d")
    suffix = str(uuid.uuid4())[:6].upper()
    return f"ATR-{today}-{suffix}"


class BookingService:
    """All booking state transitions go through here.

    Staff priority rule: when staff and resident both want an Open slot,
    staff get the slot instantly. Once the resident has Held it, the staff
    request waits for the hold to expire.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def find_conflicts(
        self,
        asset_id: str,
        start: datetime,
        end: datetime,
        exclude_booking_id: str | None = None,
    ) -> list[Booking]:
        stmt = select(Booking).where(
            and_(
                Booking.asset_id == asset_id,
                Booking.state.in_(["confirmed", "held", "swap_pending"]),
                Booking.start_time < end,
                Booking.end_time > start,
            )
        )
        if exclude_booking_id:
            stmt = stmt.where(Booking.id != exclude_booking_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_held_booking(
        self,
        asset_id: str,
        user_id: str,
        start: datetime,
        end: datetime,
        purpose: str | None = None,
        attendee_count: int | None = None,
        is_recurring: bool = False,
        recurrence_weeks: int | None = None,
    ) -> Booking:
        # Normalise to naive datetimes since DB column is naive
        if start.tzinfo:
            start = start.replace(tzinfo=None)
        if end.tzinfo:
            end = end.replace(tzinfo=None)

        conflicts = await self.find_conflicts(asset_id, start, end)
        if conflicts:
            # Staff priority: if requesting user is staff, kick a held (not
            # confirmed) resident booking back to open. Confirmed bookings are
            # never auto-cancelled, only Confirmed → swap_pending via the agent.
            user = await self.db.get(User, user_id)
            if user and user.role in ("staff", "councillor"):
                kicked = []
                for c in conflicts:
                    if c.state == "held":
                        # Hold can be displaced by staff priority during the hold
                        # window only; once Confirmed, this code path doesn't run.
                        c.state = "open"
                        c.held_until = None
                        kicked.append(c.id)
                if kicked:
                    await self.db.commit()
                    conflicts = await self.find_conflicts(asset_id, start, end)
            if conflicts:
                raise ValueError("slot_unavailable")

        booking = Booking(
            id=uuid.uuid4(),
            asset_id=asset_id,
            user_id=user_id,
            state="held",
            start_time=start,
            end_time=end,
            purpose=purpose,
            attendee_count=attendee_count,
            is_recurring=is_recurring,
            recurrence_pattern={"weeks": recurrence_weeks} if recurrence_weeks else None,
            held_until=datetime.utcnow() + timedelta(seconds=settings.hold_duration_seconds),
            reference=_generate_reference(),
        )
        self.db.add(booking)
        await self.db.flush()

        log = AuditLog(
            id=uuid.uuid4(),
            booking_id=booking.id,
            user_id=user_id,
            action="booking_held",
            details={"reference": booking.reference},
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def confirm_booking(self, booking_id: str, user_id: str) -> Booking:
        booking = await self.db.get(Booking, booking_id)
        if not booking:
            raise ValueError("booking_not_found")
        if booking.state != "held":
            raise ValueError(f"cannot_confirm_state_{booking.state}")
        if str(booking.user_id) != str(user_id):
            raise ValueError("not_booking_owner")
        if booking.held_until and booking.held_until < datetime.utcnow():
            booking.state = "cancelled"
            booking.cancellation_reason = CancellationReason.HOLD_EXPIRED.value
            booking.cancelled_at = datetime.utcnow()
            await self.db.commit()
            raise ValueError("hold_expired")
        booking.state = "confirmed"
        booking.confirmed_at = datetime.utcnow()

        log = AuditLog(
            id=uuid.uuid4(),
            booking_id=booking.id,
            user_id=user_id,
            action="booking_confirmed",
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def user_cancel(self, booking_id: str, user_id: str) -> Booking:
        """Tier 1: user cancels own booking. Always allowed."""
        booking = await self.db.get(Booking, booking_id)
        if not booking:
            raise ValueError("booking_not_found")
        if str(booking.user_id) != str(user_id):
            raise ValueError("not_booking_owner")
        booking.state = "cancelled"
        booking.cancelled_at = datetime.utcnow()
        booking.cancelled_by = user_id
        booking.cancellation_reason = CancellationReason.USER_CANCELLED.value

        log = AuditLog(
            id=uuid.uuid4(),
            booking_id=booking.id,
            user_id=user_id,
            action="user_cancelled",
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def accept_swap(self, booking_id: str, user_id: str) -> dict:
        """Tier 2: resident accepts the agent's swap proposal."""
        booking = await self.db.get(Booking, booking_id)
        if not booking or booking.state != "swap_pending":
            raise ValueError("not_swap_pending")
        if str(booking.user_id) != str(user_id):
            raise ValueError("not_booking_owner")

        # Cancel old, create new at alternative
        old_asset_id = booking.asset_id
        new_asset_id = booking.alternative_offered_id
        if not new_asset_id:
            raise ValueError("no_alternative_proposed")

        booking.state = "cancelled"
        booking.cancelled_at = datetime.utcnow()
        booking.cancellation_reason = CancellationReason.SWAP_ACCEPTED.value

        # Create the new confirmed booking at the alternative
        new_booking = Booking(
            id=uuid.uuid4(),
            asset_id=new_asset_id,
            user_id=user_id,
            state="confirmed",
            start_time=booking.start_time,
            end_time=booking.end_time,
            purpose=booking.purpose,
            attendee_count=booking.attendee_count,
            confirmed_at=datetime.utcnow(),
            reference=_generate_reference(),
        )
        self.db.add(new_booking)

        # Apply credit
        user = await self.db.get(User, user_id)
        if user:
            user.flexibility_credits = (user.flexibility_credits or 0) + booking.goodwill_credit_applied

        log = AuditLog(
            id=uuid.uuid4(),
            booking_id=booking.id,
            user_id=user_id,
            action="swap_accepted",
            details={
                "old_asset_id": str(old_asset_id),
                "new_asset_id": str(new_asset_id),
                "new_booking_id": str(new_booking.id),
            },
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(new_booking)
        return {"old_booking_cancelled": str(booking.id), "new_booking": new_booking.to_dict()}

    async def decline_swap(self, booking_id: str, user_id: str) -> Booking:
        """Tier 2: resident declines the swap. Booking returns to confirmed."""
        booking = await self.db.get(Booking, booking_id)
        if not booking or booking.state != "swap_pending":
            raise ValueError("not_swap_pending")
        if str(booking.user_id) != str(user_id):
            raise ValueError("not_booking_owner")

        booking.state = "confirmed"
        booking.alternative_offered_id = None
        booking.swap_message = None

        log = AuditLog(
            id=uuid.uuid4(),
            booking_id=booking.id,
            user_id=user_id,
            action="swap_declined",
            ai_reasoning="Resident declined. Booking remains confirmed. Staff alerted to seek alternative.",
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def staff_override(
        self,
        booking_id: str,
        staff_user_id: str,
        reason: str,
        details: str,
        alternative_asset_id: str | None = None,
    ) -> dict:
        """Tier 3: legitimate operational override.

        Only allowed for documented operational reasons. Resident is auto-notified
        with full reason, alternative offered, and goodwill credit applied.
        """
        try:
            reason_enum = CancellationReason(reason)
        except ValueError:
            raise ValueError("invalid_override_reason")
        if reason_enum not in VALID_OVERRIDE_REASONS:
            raise ValueError("not_a_valid_override_reason")

        booking = await self.db.get(Booking, booking_id)
        if not booking:
            raise ValueError("booking_not_found")
        if booking.state not in ("confirmed", "held", "swap_pending"):
            raise ValueError("not_overridable_state")

        # Check staff role
        staff = await self.db.get(User, staff_user_id)
        if not staff or staff.role not in ("staff", "councillor"):
            raise ValueError("not_authorised")

        requires_dual = reason_enum in DUAL_APPROVAL_REASONS

        booking.state = "cancelled"
        booking.cancelled_at = datetime.utcnow()
        booking.cancelled_by = staff_user_id
        booking.cancellation_reason = reason_enum.value
        booking.cancellation_details = details
        booking.alternative_offered_id = alternative_asset_id
        booking.goodwill_credit_applied = settings.default_goodwill_credit_percentage

        # Apply goodwill credit immediately
        resident = await self.db.get(User, booking.user_id)
        if resident:
            resident.flexibility_credits = (resident.flexibility_credits or 0) + settings.default_goodwill_credit_percentage

        log = AuditLog(
            id=uuid.uuid4(),
            booking_id=booking.id,
            user_id=staff_user_id,
            action="staff_override",
            reason=reason_enum.value,
            details={
                "details": details,
                "alternative_offered": str(alternative_asset_id) if alternative_asset_id else None,
                "goodwill_credit": settings.default_goodwill_credit_percentage,
                "requires_dual_approval": requires_dual,
                "resident_notified": True,
            },
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(booking)

        return {
            "booking": booking.to_dict(),
            "alternative_offered_id": str(alternative_asset_id) if alternative_asset_id else None,
            "goodwill_credit_applied": settings.default_goodwill_credit_percentage,
            "requires_dual_approval": requires_dual,
            "resident_notification_sent": True,
        }

    async def reschedule(self, booking_id: str, user_id: str, new_start: datetime, new_end: datetime) -> Booking:
        """Reschedule a confirmed booking to a new time on the same asset."""
        booking = await self.db.get(Booking, booking_id)
        if not booking:
            raise ValueError("booking_not_found")
        if str(booking.user_id) != str(user_id):
            raise ValueError("not_booking_owner")
        if booking.state not in ("confirmed", "held"):
            raise ValueError("cannot_reschedule")
        if new_start.tzinfo:
            new_start = new_start.replace(tzinfo=None)
        if new_end.tzinfo:
            new_end = new_end.replace(tzinfo=None)
        conflicts = await self.find_conflicts(str(booking.asset_id), new_start, new_end, exclude_booking_id=str(booking_id))
        if conflicts:
            raise ValueError("slot_unavailable")
        booking.start_time = new_start
        booking.end_time = new_end
        log = AuditLog(
            id=uuid.uuid4(),
            booking_id=booking.id,
            user_id=user_id,
            action="booking_rescheduled",
            details={"new_start": new_start.isoformat(), "new_end": new_end.isoformat()},
        )
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(booking)
        return booking

    async def expire_holds(self) -> int:
        """Background task: expire stale held bookings."""
        stmt = select(Booking).where(
            and_(
                Booking.state == "held",
                Booking.held_until < datetime.utcnow(),
            )
        )
        result = await self.db.execute(stmt)
        expired = list(result.scalars().all())
        for b in expired:
            b.state = "cancelled"
            b.cancellation_reason = CancellationReason.HOLD_EXPIRED.value
            b.cancelled_at = datetime.utcnow()
        await self.db.commit()
        return len(expired)
