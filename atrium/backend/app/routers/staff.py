"""Staff router: dashboard, agent feed, override modal, asset management."""
import asyncio
import csv
import io
import logging
import uuid
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_

from app.config import settings
from app.database import get_db
from app.dependencies import require_staff
from app.schemas.search import StaffOverrideRequest
from app.services.booking_service import BookingService
from app.agents.conflict_agent import ConflictResolutionAgent
from app.services.email_service import send_email, booking_cancelled_html
from app.models.user import User
from app.models.audit_log import AuditLog
from app.models.booking import Booking
from app.models.asset import Asset
from app.models.payment import Payment
from app.models.agent_run import AgentRun
from app.models.search_log import SearchLog


class ConflictResolveRequest(BaseModel):
    booking_id: UUID
    priority_request_summary: str = Field(..., min_length=1, max_length=500)


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


@router.post("/resolve-conflict")
async def resolve_conflict(
    req: ConflictResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_staff: User = Depends(require_staff),
):
    """Agent-first conflict resolution.

    When staff raise a priority need over a confirmed booking, the autonomous
    agent runs immediately and either:
      • proposes a swap to the resident (alternative + goodwill credit), or
      • escalates to a human when no suitable alternative exists.

    The booking is never cancelled here — the resident decides on a proposed
    swap, and a human handles escalations via /override. Returns a shaped
    verdict the staff UI can act on directly.
    """
    booking = await db.get(Booking, str(req.booking_id))
    if not booking:
        raise HTTPException(status_code=404, detail="booking_not_found")
    if booking.state != "confirmed":
        raise HTTPException(status_code=400, detail="only_confirmed_bookings_can_be_resolved")

    agent = ConflictResolutionAgent(db)
    result = await agent.resolve(
        confirmed_booking_id=str(req.booking_id),
        priority_request_summary=req.priority_request_summary,
    )
    decision = result.get("final_decision")

    # The agent wrote to the booking via this same session and committed; reload
    # so we report the freshest state (swap fields / state).
    await db.refresh(booking)

    base = {
        "agent_run_id": result.get("agent_run_id"),
        "final_decision": decision,
        "steps": result.get("steps", []),
        "booking_id": str(req.booking_id),
    }

    # The booking's actual state is the source of truth — not just the agent's
    # self-reported final_decision (the live model may set the swap but forget
    # to log the decision). If a swap was placed, that's the real outcome.
    if booking.state == "swap_pending" and booking.alternative_offered_id:
        alt = await db.get(Asset, booking.alternative_offered_id)
        credit = booking.goodwill_credit_applied or 0
        return {
            **base,
            "outcome": "swap_proposed",
            "resolved_by_agent": True,
            "awaiting_resident": True,
            "requires_human": False,
            "alternative": alt.to_dict() if alt else None,
            "goodwill_credit_percent": credit,
            "resident_message": booking.swap_message,
            "headline": (
                f"Agent proposed a swap to {alt.name} ({alt.ward}) with a {credit}% goodwill credit. "
                f"Awaiting the resident's decision — their original booking stays put unless they accept."
                if alt else
                f"Agent proposed a swap with a {credit}% goodwill credit. Awaiting the resident's decision."
            ),
        }

    # No swap was placed → the agent escalated (or couldn't complete). Either
    # way the human takes over; the booking is untouched and still confirmed.
    esc = next(
        (s for s in result.get("steps", [])
         if s.get("type") == "tool_call" and s.get("tool") == "escalate_to_staff"),
        None,
    )
    escalation_reason = (esc or {}).get("args", {}).get("recommendation")
    return {
        **base,
        "outcome": "escalated",
        "resolved_by_agent": False,
        "awaiting_resident": False,
        "requires_human": True,
        "escalation_reason": escalation_reason,
        "headline": escalation_reason or (
            "The agent couldn't find a suitable alternative for the resident. "
            "Escalated for your review — you may proceed with a documented override if it's genuinely necessary."
        ),
    }


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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Staff cancelled the booking — the resident is refunded in full (it's not
    # their fault). The goodwill credit + in-app notification are applied in the
    # service; here we issue the Stripe refund and send the cancellation email.
    refund_info = None
    if settings.stripe_secret_key:
        try:
            import stripe as _stripe
            _stripe.api_key = settings.stripe_secret_key
            pres = await db.execute(
                select(Payment).where(
                    Payment.booking_id == req.booking_id,
                    Payment.status == "succeeded",
                ).with_for_update()
            )
            payment = pres.scalar_one_or_none()
            if payment and payment.amount_pence > 0:
                refunded = payment.amount_pence
                refund = await asyncio.to_thread(
                    _stripe.Refund.create,
                    payment_intent=payment.stripe_payment_intent_id,
                    amount=refunded,
                )
                payment.refund_id = refund.id
                payment.status = "refunded"
                payment.amount_pence = 0
                await db.commit()
                refund_info = {"refunded": True, "amount": f"£{refunded / 100:.2f}"}
        except Exception as exc:
            logger.error("override_refund_error booking_id=%s err=%s", str(req.booking_id), str(exc))
            refund_info = {"refunded": False, "message": "Cancellation processed; refund requires manual review."}

    booking = await db.get(Booking, str(req.booking_id))
    if booking:
        resident = await db.get(User, booking.user_id)
        asset = await db.get(Asset, booking.asset_id)
        if resident and resident.email:
            asyncio.create_task(send_email(
                to=resident.email,
                subject="Your HillingOne booking has been cancelled by the council",
                html=booking_cancelled_html(
                    resident.name, booking, asset,
                    refund_info.get("amount") if refund_info else None,
                    late_cancel=False,
                ),
            ))

    if refund_info:
        result["refund"] = refund_info
    return result


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


@router.get("/bookings")
async def search_bookings(q: str = "", db: AsyncSession = Depends(get_db)):
    """Staff booking lookup by reference, resident name/email, or venue name.
    Used to find a confirmed booking to put to the conflict-resolution agent."""
    stmt = (
        select(Booking, Asset, User)
        .outerjoin(Asset, Asset.id == Booking.asset_id)
        .outerjoin(User, User.id == Booking.user_id)
        .order_by(Booking.start_time.desc())
        .limit(25)
    )
    q = (q or "").strip()
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(
            Booking.reference.ilike(like),
            User.email.ilike(like),
            User.name.ilike(like),
            Asset.name.ilike(like),
        ))
    result = await db.execute(stmt)
    return [
        {
            "id": str(b.id),
            "reference": b.reference,
            "state": b.state,
            "start_time": b.start_time.isoformat() if b.start_time else None,
            "end_time": b.end_time.isoformat() if b.end_time else None,
            "resident_name": u.name if u else None,
            "resident_email": u.email if u else None,
            "asset_name": a.name if a else None,
            "ward": a.ward if a else None,
        }
        for b, a, u in result.all()
    ]


@router.get("/decision-history")
async def decision_history(db: AsyncSession = Depends(get_db)):
    """Resolved conflict decisions — what happened after a swap was proposed
    (resident accepted / declined) plus staff overrides, newest first."""
    actions = ["swap_accepted", "swap_declined", "staff_override"]
    stmt = (
        select(AuditLog, Booking, Asset, User)
        .outerjoin(Booking, Booking.id == AuditLog.booking_id)
        .outerjoin(Asset, Asset.id == Booking.asset_id)
        .outerjoin(User, User.id == Booking.user_id)  # resident (booking owner)
        .where(AuditLog.action.in_(actions))
        .order_by(desc(AuditLog.created_at))
        .limit(25)
    )
    rows = (await db.execute(stmt)).all()

    LABELS = {
        "swap_accepted": ("accepted", "Resident accepted the swap"),
        "swap_declined": ("declined", "Resident kept their booking"),
        "staff_override": ("overridden", "Staff override — booking cancelled"),
    }
    out = []
    for log, booking, asset, resident in rows:
        outcome, label = LABELS.get(log.action, (log.action, log.action))
        out.append({
            "id": str(log.id),
            "outcome": outcome,
            "label": label,
            "reference": booking.reference if booking else None,
            "asset_name": asset.name if asset else None,
            "ward": asset.ward if asset else None,
            "resident_name": resident.name if resident else None,
            "reason": (log.reason or "").replace("_", " ") if log.reason else None,
            "at": log.created_at.isoformat(),
        })
    return out


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
