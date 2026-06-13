"""Reminder and calendar service.

Two purposes you asked for:
1. Schedule encouraging reminders so users don't forget their bookings
2. Generate iCalendar (.ics) files so they can add to their calendar
"""
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from icalendar import Calendar, Event, vText

from app.models.reminder import Reminder
from app.models.booking import Booking
from app.models.asset import Asset
from app.models.user import User
from app.services.gemini_client import generate_encouragement


# Default reminder schedule for confirmed bookings:
# - 1 day before
# - 1 hour before
DEFAULT_OFFSETS = [timedelta(days=1), timedelta(hours=1)]


def build_notification(user_id, message: str, booking_id=None) -> Reminder:
    """Build an immediate in-app notification (appears in the bell straight away).

    Returned unsaved — the caller adds it to its session and commits within its
    own transaction so the notification is atomic with the action it describes.
    """
    return Reminder(
        id=uuid.uuid4(),
        booking_id=booking_id,
        user_id=user_id,
        remind_at=datetime.utcnow(),
        channel="in_app",
        message=message,
    )


class ReminderService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def schedule_for_booking(self, booking: Booking) -> list[Reminder]:
        """Schedule the default reminder set for a confirmed booking.

        Generates an AI-written encouraging message for each reminder.
        """
        asset = await self.db.get(Asset, booking.asset_id)
        user = await self.db.get(User, booking.user_id)
        if not asset or not user:
            return []

        encouragement = await generate_encouragement(
            user_name=user.name,
            asset_name=asset.name,
            ward=asset.ward,
            start_time=booking.start_time.strftime("%A %d %B at %H:%M"),
            purpose=booking.purpose,
        )

        created = []
        for offset in DEFAULT_OFFSETS:
            remind_at = booking.start_time - offset
            if remind_at < datetime.utcnow():
                continue
            label = "tomorrow" if offset == timedelta(days=1) else "in one hour"
            message = (
                f"Reminder: your booking at {asset.name} ({asset.ward}) is {label} "
                f"on {booking.start_time.strftime('%A %d %B at %H:%M')}. Reference {booking.reference}."
            )
            reminder = Reminder(
                id=uuid.uuid4(),
                booking_id=booking.id,
                user_id=booking.user_id,
                remind_at=remind_at,
                channel="in_app",
                message=message,
                encouragement=encouragement,
            )
            self.db.add(reminder)
            created.append(reminder)
        await self.db.commit()
        return created

    async def get_due_reminders(self, user_id: str | None = None) -> list[Reminder]:
        """Fetch reminders that are due (and unsent) for in-app display."""
        from sqlalchemy import select, and_
        stmt = select(Reminder).where(
            and_(
                Reminder.sent == False,  # noqa: E712
                Reminder.remind_at <= datetime.utcnow(),
            )
        )
        if user_id:
            stmt = stmt.where(Reminder.user_id == user_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def mark_sent(self, reminder_id: str) -> None:
        reminder = await self.db.get(Reminder, reminder_id)
        if reminder:
            reminder.sent = True
            reminder.sent_at = datetime.utcnow()
            await self.db.commit()


def generate_ics(booking: Booking, asset: Asset, user: User) -> bytes:
    """Generate an iCalendar (.ics) file for adding the booking to the user's calendar."""
    cal = Calendar()
    cal.add("prodid", "-//Atrium Hillingdon//hillingdon.gov.uk//EN")
    cal.add("version", "2.0")
    cal.add("method", "PUBLISH")

    event = Event()
    event.add("uid", f"atrium-{booking.id}@hillingdon.gov.uk")
    event.add("summary", f"Atrium booking: {asset.name}")
    event.add("dtstart", booking.start_time)
    event.add("dtend", booking.end_time)
    event.add("dtstamp", datetime.utcnow())
    event.add(
        "description",
        f"Booking reference: {booking.reference}\n"
        f"Venue: {asset.name}, {asset.ward}\n"
        f"Capacity: {asset.capacity}\n"
        f"Purpose: {booking.purpose or 'Not specified'}\n\n"
        f"This booking is protected by Atrium. It cannot be cancelled by anyone "
        f"except you, or by staff for a documented operational reason. If staff "
        f"need to cancel, you will be notified immediately with the full reason "
        f"and an alternative venue offered.",
    )
    event.add("location", vText(f"{asset.name}, {asset.ward}, Hillingdon, London"))
    event.add("organizer", vText("MAILTO:bookings@hillingdon.gov.uk"))
    event.add("status", "CONFIRMED")

    # Built-in reminders inside the calendar invite
    from icalendar import Alarm
    alarm_day = Alarm()
    alarm_day.add("action", "DISPLAY")
    alarm_day.add("description", f"Tomorrow: your booking at {asset.name}")
    alarm_day.add("trigger", timedelta(days=-1))
    event.add_component(alarm_day)

    alarm_hour = Alarm()
    alarm_hour.add("action", "DISPLAY")
    alarm_hour.add("description", f"In one hour: {asset.name}")
    alarm_hour.add("trigger", timedelta(hours=-1))
    event.add_component(alarm_hour)

    cal.add_component(event)
    return cal.to_ical()
