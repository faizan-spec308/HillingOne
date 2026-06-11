"""Reminders router."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.dependencies import get_current_user
from app.models.reminder import Reminder
from app.models.user import User
from app.services.reminder_service import ReminderService

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("/due")
async def due_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = ReminderService(db)
    items = await svc.get_due_reminders(user_id=str(current_user.id))
    return [r.to_dict() for r in items]


@router.get("/all")
async def all_reminders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(Reminder)
        .where(Reminder.user_id == current_user.id)
        .order_by(desc(Reminder.remind_at))
        .limit(50)
    )
    result = await db.execute(stmt)
    return [r.to_dict() for r in result.scalars().all()]


@router.post("/{reminder_id}/dismiss")
async def dismiss_reminder(
    reminder_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = ReminderService(db)
    await svc.mark_sent(reminder_id)
    return {"success": True}
