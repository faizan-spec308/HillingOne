"""Staff router: dashboard, agent feed, override modal."""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.database import get_db
from app.dependencies import require_staff
from app.schemas.search import StaffOverrideRequest
from app.services.booking_service import BookingService
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.booking import Booking
from app.models.asset import Asset
from app.models.agent_run import AgentRun
from app.models.search_log import SearchLog

router = APIRouter(prefix="/api/staff", tags=["staff"], dependencies=[Depends(require_staff)])
logger = logging.getLogger("hillingone.staff")


@router.post("/override")
async def staff_override(
    req: StaffOverrideRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: User = Depends(require_staff),
):
    svc = BookingService(db)
    try:
        result = await svc.staff_override(
            booking_id=req.booking_id,
            staff_user_id=str(current_staff.id),
            reason=req.reason,
            details=req.details,
            alternative_asset_id=req.alternative_asset_id,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    """Live agent feed + utilisation stats + key metrics."""
    # Recent audit log entries
    feed_stmt = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(15)
    feed_result = await db.execute(feed_stmt)
    feed = [a.to_dict() for a in feed_result.scalars().all()]

    week_ago = datetime.utcnow() - timedelta(days=7)

    # Asset utilisation — single GROUP BY query for booking counts + total hours
    count_stmt = (
        select(
            Booking.asset_id,
            func.count().label("b_count"),
            func.sum(
                func.extract("epoch", Booking.end_time - Booking.start_time) / 3600
            ).label("hours_booked"),
        )
        .where(Booking.state == "confirmed", Booking.start_time >= week_ago)
        .group_by(Booking.asset_id)
    )
    count_result = await db.execute(count_stmt)
    booking_stats = {str(row.asset_id): (row.b_count, float(row.hours_booked or 0)) for row in count_result}

    asset_stmt = select(Asset).where(Asset.is_active == True)  # noqa: E712
    asset_result = await db.execute(asset_stmt)
    assets = list(asset_result.scalars().all())

    # 84 available hours per week (12h/day × 7 days)
    AVAILABLE_HOURS_PER_WEEK = 84

    asset_util = []
    for asset in assets:
        b_count, hours_booked = booking_stats.get(str(asset.id), (0, 0.0))
        utilisation_pct = min(100, int((hours_booked / AVAILABLE_HOURS_PER_WEEK) * 100))
        if utilisation_pct < 30:
            colour = "blue"
        elif utilisation_pct < 70:
            colour = "green"
        else:
            colour = "amber"
        asset_util.append({
            **asset.to_dict(),
            "weekly_bookings": b_count,
            "hours_booked": round(hours_booked, 1),
            "utilisation_pct": utilisation_pct,
            "colour": colour,
        })

    # Top metrics
    total_bookings_stmt = select(func.count()).select_from(Booking).where(
        Booking.created_at >= week_ago,
        Booking.state.in_(["confirmed", "completed"]),
    )
    total_bookings = (await db.execute(total_bookings_stmt)).scalar() or 0

    # Pending swap responses
    pending_stmt = select(Booking).where(Booking.state == "swap_pending")
    pending_result = await db.execute(pending_stmt)
    pending_swaps = [p.to_dict() for p in pending_result.scalars().all()]

    # Recent agent runs
    run_stmt = select(AgentRun).order_by(desc(AgentRun.created_at)).limit(5)
    run_result = await db.execute(run_stmt)
    recent_agent_runs = [r.to_dict() for r in run_result.scalars().all()]

    # Demand sensing: searches with no good match
    weak_search_stmt = (
        select(SearchLog)
        .where(SearchLog.results_count <= 1, SearchLog.created_at >= week_ago)
        .order_by(desc(SearchLog.created_at))
        .limit(5)
    )
    weak = (await db.execute(weak_search_stmt)).scalars().all()

    return {
        "principles": [
            "Staff get priority on availability. Residents get priority on certainty.",
            "Bookings can only be overridden with documented reason and resident protection.",
            "The agent suggests, the human decides.",
            "Every action is logged. Every cancellation is explained. Every resident is offered an alternative.",
        ],
        "metrics": {
            "weekly_bookings": total_bookings,
            "weekly_hours_booked": sum(v[1] for v in booking_stats.values()),
        },
        "agent_feed": feed,
        "asset_utilisation": asset_util,
        "pending_swap_responses": pending_swaps,
        "recent_agent_runs": recent_agent_runs,
        "demand_alerts": [
            {
                "raw_query": s.raw_query,
                "results_count": s.results_count,
                "at": s.created_at.isoformat(),
            }
            for s in weak
        ],
    }


@router.get("/decision-queue")
async def decision_queue(db: AsyncSession = Depends(get_db)):
    """Return pending swap decisions with asset data using a single JOIN query."""
    stmt = (
        select(Booking, Asset)
        .outerjoin(Asset, Asset.id == Booking.asset_id)
        .where(Booking.state == "swap_pending")
    )
    result = await db.execute(stmt)
    rows = result.all()

    # Gather alternative asset IDs in one query
    alt_ids = [b.alternative_offered_id for b, _ in rows if b.alternative_offered_id]
    alt_assets: dict = {}
    if alt_ids:
        alt_stmt = select(Asset).where(Asset.id.in_(alt_ids))
        alt_result = await db.execute(alt_stmt)
        alt_assets = {str(a.id): a for a in alt_result.scalars().all()}

    return [
        {
            "booking": b.to_dict(),
            "asset": a.to_dict() if a else None,
            "alternative": alt_assets[str(b.alternative_offered_id)].to_dict()
                           if b.alternative_offered_id and str(b.alternative_offered_id) in alt_assets
                           else None,
        }
        for b, a in rows
    ]
