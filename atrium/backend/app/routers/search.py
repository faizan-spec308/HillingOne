"""Search router: parse intent + rank matches."""
import re
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
from app.services.gemini_client import parse_intent, rank_matches, _match_ward
from app.limiter import limiter

router = APIRouter(prefix="/api/search", tags=["search"])


def _extract_capacity(text: str) -> int | None:
    """Pull a headcount from the raw query. Prefers an explicit '... people'
    style phrase so dates/times ('20th', '12pm') are never mistaken for it."""
    t = text.lower()
    m = re.search(r"(\d{1,4})\s*(?:people|person|persons|ppl|guests?|attendees?|pax|seats?)", t)
    if m:
        return int(m.group(1))
    for tok in re.findall(r"(?<![\w])(\d{1,4})(?![\w])", t):
        n = int(tok)
        if 2 <= n <= 1000:
            return n
    return None


@router.post("")
@limiter.limit("20/minute")
async def search(request: Request, req: SearchRequest, db: AsyncSession = Depends(get_db)):
    intent = await parse_intent(req.query)

    # Enforce hard constraints deterministically from the raw query. The model
    # reliably *echoes* the location/headcount in its summary but often fails to
    # populate the structured fields the search filters on, which let venues in
    # the wrong ward or far too small slip into the results. When the query
    # plainly states a ward or a headcount, that wins over the model.
    det_ward = _match_ward(req.query)
    if det_ward:
        intent["location"] = det_ward
    det_capacity = _extract_capacity(req.query)
    if det_capacity:
        intent["capacity"] = det_capacity

    # Build the target window — use specific_date if Gemini resolved one, else default to +2 days
    specific_date = intent.get("specific_date")
    if specific_date:
        try:
            base = datetime.fromisoformat(specific_date)
        except ValueError:
            base = datetime.utcnow() + timedelta(days=2)
    else:
        base = datetime.utcnow() + timedelta(days=2)

    # An explicit hour ("2pm", "14:00") takes precedence over the coarse
    # time-of-day bucket; both fall back to the afternoon default.
    specific_hour = intent.get("specific_hour")
    tod = intent.get("time_of_day")
    if isinstance(specific_hour, int) and 0 <= specific_hour <= 23:
        base = base.replace(hour=specific_hour, minute=0, second=0, microsecond=0)
    elif tod == "morning":
        base = base.replace(hour=10, minute=0, second=0, microsecond=0)
    elif tod == "evening":
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

    # Capacity is a hard filter (above) — it keeps equipment and far-too-small
    # rooms out. Location is NOT a hard filter: a resident who names a ward wants
    # that ward's venue ranked first and treated as a strong match, but should
    # still see other options below (that's what the confidence scores are for).
    location = (intent.get("location") or "").strip().lower()
    result = await db.execute(stmt)
    available = list(result.scalars().all())

    inventory_dicts = [a.to_dict() for a in available]
    matches = await rank_matches(intent, inventory_dicts)

    # Attach full asset data to each match
    asset_by_id = {a.to_dict()["id"]: a.to_dict() for a in available}
    for m in matches:
        m["asset"] = asset_by_id.get(m.get("asset_id"), {})

    # Promote the requested ward: its venues go to the top as high-confidence
    # matches (never dropped just because the model ranked them lower), and other
    # options are kept below with their confidence capped under the ward matches.
    if location and location != "anywhere":
        ward_ids = [aid for aid, a in asset_by_id.items() if location in (a.get("ward") or "").lower()]
        ward_matches = []
        for aid in ward_ids:
            a = asset_by_id[aid]
            existing = next((m for m in matches if m.get("asset_id") == aid), None)
            if existing:
                existing["match_score"] = max(existing.get("match_score") or 0, 90)
                existing["reasoning"] = existing.get("reasoning") or f"{a.get('name')} is in {a.get('ward')} and fits your group."
                ward_matches.append(existing)
            else:
                ward_matches.append({
                    "asset_id": aid,
                    "rank": 1,
                    "match_score": 92,
                    "reasoning": f"{a.get('name')} is in {a.get('ward')} and fits your group size.",
                    "carbon_estimate_kg": a.get("co2_per_visit") or 0.5,
                    "accessibility_match": "full" if (a.get("accessibility") or {}).get("wheelchair_access") else "partial",
                    "asset": a,
                })
        others = [m for m in matches if m.get("asset_id") not in set(ward_ids)]
        for m in others:
            m["match_score"] = min(m.get("match_score") or 50, 70)
        # Sort ward matches by best capacity fit (smallest venue that still fits first)
        ward_matches.sort(key=lambda m: (m["asset"].get("capacity") or 9999))
        matches = ward_matches + others

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
