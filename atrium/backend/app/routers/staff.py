"""Staff router: dashboard, agent feed, override modal, asset management."""
import csv
import io
import logging
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
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


class AssetUpsertRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str = Field(..., min_length=1, max_length=100)
    ward: str = Field(..., min_length=1, max_length=100)
    capacity: int = Field(..., ge=1, le=10000)
    hourly_rate: float = Field(0.0, ge=0)
    description: str | None = Field(None, max_length=2000)
    amenities: dict = Field(default_factory=dict)
    accessibility: dict = Field(default_factory=dict)
    image_url: str | None = Field(None, max_length=500)

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
            booking_id=str(req.booking_id),
            staff_user_id=str(current_staff.id),
            reason=req.reason,
            details=req.details,
            alternative_asset_id=str(req.alternative_asset_id) if req.alternative_asset_id else None,
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
            "weekly_hours_booked": round(sum(v[1] for v in booking_stats.values()), 1),
            "estimated_staff_hours_saved": round(total_bookings * 0.33, 1),
            "phone_calls_avoided": total_bookings,
            "interfaces_replaced": 5,
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


@router.get("/export")
async def export_bookings_csv(
    from_date: str | None = None,
    to_date: str | None = None,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Export bookings as CSV. Optional filters: from_date, to_date (ISO), state."""
    stmt = (
        select(Booking, Asset, User)
        .outerjoin(Asset, Asset.id == Booking.asset_id)
        .outerjoin(User, User.id == Booking.user_id)
        .order_by(Booking.start_time.desc())
    )
    if from_date:
        stmt = stmt.where(Booking.start_time >= datetime.fromisoformat(from_date))
    if to_date:
        stmt = stmt.where(Booking.start_time <= datetime.fromisoformat(to_date))
    if state:
        stmt = stmt.where(Booking.state == state)

    result = await db.execute(stmt)
    rows = result.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "reference", "state", "resident_name", "resident_email",
        "asset_name", "ward", "category",
        "start_time", "end_time", "duration_hours",
        "purpose", "attendee_count", "amount_paid_gbp",
    ])
    for booking, asset, user in rows:
        duration = round(
            (booking.end_time - booking.start_time).total_seconds() / 3600, 2
        ) if booking.start_time and booking.end_time else ""
        writer.writerow([
            booking.reference,
            booking.state,
            user.name if user else "",
            user.email if user else "",
            asset.name if asset else "",
            asset.ward if asset else "",
            asset.category if asset else "",
            booking.start_time.isoformat() if booking.start_time else "",
            booking.end_time.isoformat() if booking.end_time else "",
            duration,
            booking.purpose or "",
            booking.attendee_count or "",
            round(getattr(booking, "total_amount_pence", 0) / 100, 2) if getattr(booking, "total_amount_pence", None) else "0.00",
        ])

    output.seek(0)
    filename = f"hillingone-bookings-{datetime.utcnow().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Asset management ───────────────────────────────────────────────────────

@router.get("/assets")
async def list_all_assets(db: AsyncSession = Depends(get_db)):
    """List all assets including inactive ones — staff only."""
    result = await db.execute(select(Asset).order_by(Asset.ward, Asset.name))
    return [a.to_dict() for a in result.scalars().all()]


@router.post("/assets", status_code=201)
async def create_asset(
    req: AssetUpsertRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: User = Depends(require_staff),
):
    asset = Asset(
        id=uuid.uuid4(),
        name=req.name,
        category=req.category,
        ward=req.ward,
        capacity=req.capacity,
        hourly_rate=Decimal(str(req.hourly_rate)),
        description=req.description,
        amenities=req.amenities,
        accessibility=req.accessibility,
        image_url=req.image_url,
        is_active=True,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    logger.info("asset_created id=%s name=%s by=%s", str(asset.id), asset.name, str(current_staff.id))
    return asset.to_dict()


@router.patch("/assets/{asset_id}")
async def update_asset(
    asset_id: str,
    req: AssetUpsertRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: User = Depends(require_staff),
):
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset.name = req.name
    asset.category = req.category
    asset.ward = req.ward
    asset.capacity = req.capacity
    asset.hourly_rate = Decimal(str(req.hourly_rate))
    asset.description = req.description
    asset.amenities = req.amenities
    asset.accessibility = req.accessibility
    asset.image_url = req.image_url
    await db.commit()
    await db.refresh(asset)
    logger.info("asset_updated id=%s by=%s", asset_id, str(current_staff.id))
    return asset.to_dict()


@router.patch("/assets/{asset_id}/toggle")
async def toggle_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    current_staff: User = Depends(require_staff),
):
    asset = await db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset.is_active = not asset.is_active
    await db.commit()
    await db.refresh(asset)
    logger.info("asset_toggled id=%s active=%s by=%s", asset_id, asset.is_active, str(current_staff.id))
    return asset.to_dict()
