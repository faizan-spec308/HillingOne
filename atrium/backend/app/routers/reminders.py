"""Reminders router."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.models.reminder import Reminder
from app.services.reminder_service import ReminderService

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("/due")
async def due_reminders(user_id: str | None = None, db: AsyncSession = Depends(get_db)):
    svc = ReminderService(db)
    items = await svc.get_due_reminders(user_id=user_id)
    return [r.to_dict() for r in items]


@router.get("/all")
async def all_reminders(user_id: str | None = None, db: AsyncSession = Depends(get_db)):
    stmt = select(Reminder).order_by(desc(Reminder.remind_at)).limit(50)
    if user_id:
        stmt = stmt.where(Reminder.user_id == user_id)
    result = await db.execute(stmt)
    return [r.to_dict() for r in result.scalars().all()]


@router.post("/{reminder_id}/mark-sent")
async def mark_sent(reminder_id: str, db: AsyncSession = Depends(get_db)):
    svc = ReminderService(db)
    await svc.mark_sent(reminder_id)
    return {"success": True}
