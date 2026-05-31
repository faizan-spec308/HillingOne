"""Staff router: dashboard, agent feed, override modal."""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.database import get_db
from app.schemas.search import StaffOverrideRequest
from app.services.booking_service import BookingService
from app.models.audit_log import AuditLog
from app.models.booking import Booking
from app.models.asset import Asset
from app.models.agent_run import AgentRun
from app.models.search_log import SearchLog

router = APIRouter(prefix="/api/staff", tags=["staff"])


@router.post("/override")
async def staff_override(req: StaffOverrideRequest, db: AsyncSession = Depends(get_db)):
    svc = BookingService(db)
    try:
        result = await svc.staff_override(
            booking_id=req.booking_id,
            staff_user_id=req.staff_user_id,
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
    # Recent audit log entries (this becomes the agent feed)
    feed_stmt = select(AuditLog).order_by(desc(AuditLog.created_at)).limit(15)
    feed_result = await db.execute(feed_stmt)
    feed = [a.to_dict() for a in feed_result.scalars().all()]

    # Asset utilisation
    asset_stmt = select(Asset).where(Asset.is_active == True)  # noqa: E712
    asset_result = await db.execute(asset_stmt)
    assets = list(asset_result.scalars().all())

    week_ago = datetime.utcnow() - timedelta(days=7)
    asset_util = []
    for asset in assets:
        # Count confirmed bookings in past week
        b_stmt = select(func.count()).select_from(Booking).where(
            Booking.asset_id == asset.id,
            Booking.state == "confirmed",
            Booking.start_time >= week_ago,
        )
        b_count = (await db.execute(b_stmt)).scalar() or 0
        # Available hours per week (assume 12h/day, 7 days = 84h)
        utilisation_pct = min(100, int((b_count * 2 / 84) * 100))
        if utilisation_pct < 30:
            colour = "blue"
        elif utilisation_pct < 70:
            colour = "green"
        else:
            colour = "amber"
        asset_util.append({
            **asset.to_dict(),
            "weekly_bookings": b_count,
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
            "estimated_staff_hours_saved": total_bookings * 0.7,
            "phone_calls_avoided": int(total_bookings * 1.1),
            "interfaces_replaced": 17,
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
    pending_stmt = select(Booking).where(Booking.state == "swap_pending")
    pending_result = await db.execute(pending_stmt)
    items = []
    for b in pending_result.scalars().all():
        asset = await db.get(Asset, b.asset_id)
        alt = await db.get(Asset, b.alternative_offered_id) if b.alternative_offered_id else None
        items.append({
            "booking": b.to_dict(),
            "asset": asset.to_dict() if asset else None,
            "alternative": alt.to_dict() if alt else None,
        })
    return items
