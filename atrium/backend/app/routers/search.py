"""Search router: parse intent + rank matches."""
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, exists

from app.database import get_db
from app.models.asset import Asset
from app.models.booking import Booking
from app.models.search_log import SearchLog
from app.schemas.search import SearchRequest
from app.services.gemini_client import parse_intent, rank_matches
from app.limiter import limiter

router = APIRouter(prefix="/api/search", tags=["search"])


@router.post("")
@limiter.limit("20/minute")
async def search(request: Request, req: SearchRequest, db: AsyncSession = Depends(get_db)):
    intent = await parse_intent(req.query)

    # Choose a target window for availability filtering
    base = datetime.utcnow() + timedelta(days=2)
    if intent.get("time_of_day") == "morning":
        base = base.replace(hour=10, minute=0, second=0, microsecond=0)
    elif intent.get("time_of_day") == "afternoon":
        base = base.replace(hour=14, minute=0, second=0, microsecond=0)
    elif intent.get("time_of_day") == "evening":
        base = base.replace(hour=18, minute=0, second=0, microsecond=0)
    else:
        base = base.replace(hour=14, minute=0, second=0, microsecond=0)
    duration = intent.get("duration_hours") or 2
    end = base + timedelta(hours=duration)

    # Single anti-join query: get all active assets that have no conflicting bookings
    conflict_sub = (
        select(Booking.id).where(
            Booking.asset_id == Asset.id,
            Booking.state.in_(["confirmed", "held", "swap_pending"]),
            Booking.start_time < end,
            Booking.end_time > base,
        ).correlate(Asset)
    )
    stmt = select(Asset).where(
        Asset.is_active == True,  # noqa: E712
        ~exists(conflict_sub),
    )
    if intent.get("capacity"):
        stmt = stmt.where(Asset.capacity >= intent["capacity"])

    result = await db.execute(stmt)
    available = list(result.scalars().all())

    inventory_dicts = [a.to_dict() for a in available]
    matches = await rank_matches(intent, inventory_dicts)

    # Attach full asset data to each match
    asset_by_id = {a.to_dict()["id"]: a.to_dict() for a in available}
    for m in matches:
        m["asset"] = asset_by_id.get(m.get("asset_id"), {})

    # Log the search
    sl = SearchLog(
        id=uuid.uuid4(),
        user_id=req.user_id if req.user_id else None,
        raw_query=req.query,
        parsed_intent=intent,
        results_count=len(matches),
    )
    db.add(sl)
    await db.commit()

    return {
        "intent": intent,
        "matches": matches,
        "total_inventory_searched": len(available),
        "search_log_id": str(sl.id),
        "search_window": {
            "start": base.isoformat(),
            "end": end.isoformat(),
        },
    }
