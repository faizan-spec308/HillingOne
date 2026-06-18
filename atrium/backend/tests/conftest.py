"""Test harness — in-memory SQLite, fresh schema per test, no external infra.

Models use portable column types (app/db_types.py), so the same schema that runs
on Postgres in production runs on SQLite here.
"""
import os
from datetime import datetime, timedelta
from types import SimpleNamespace
import uuid

# Must be set before importing app.config / app.database.
os.environ.setdefault("JWT_SECRET", "test-secret-not-the-default-value-please")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")
os.environ.setdefault("GEMINI_API_KEY", "")      # force deterministic agent
os.environ.setdefault("STRIPE_SECRET_KEY", "")
os.environ.setdefault("RESEND_API_KEY", "")

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
# Import every model so the metadata is complete for create_all.
from app.models.user import User
from app.models.asset import Asset
from app.models.booking import Booking
from app.models.payment import Payment
from app.models import audit_log, agent_run, reminder, search_log  # noqa: F401


@pytest_asyncio.fixture
async def db():
    """Fresh in-memory DB + session per test (own engine → no cross-loop issues)."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    async with Session() as session:
        yield session
    await engine.dispose()


# ── Factories ───────────────────────────────────────────────────────────────
async def _make_user(db, role="resident", ward="Hayes Town", email=None, credits=0):
    u = User(
        id=uuid.uuid4(),
        email=email or f"{uuid.uuid4().hex[:8]}@test.com",
        name="Test User",
        role=role,
        ward=ward,
        flexibility_credits=credits,
        password_hash="x",
    )
    db.add(u)
    await db.commit()
    await db.refresh(u)
    return u


async def _make_asset(db, name="Hayes End", ward="Hayes Town", capacity=60,
                      kitchen=True, wheelchair=True, category="community_centres", rate=0):
    a = Asset(
        id=uuid.uuid4(),
        name=name,
        category=category,
        ward=ward,
        capacity=capacity,
        accessibility={"wheelchair_access": wheelchair},
        amenities={"kitchen": kitchen},
        hourly_rate=rate,
    )
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return a


async def _make_booking(db, asset, user, state="confirmed", start=None, end=None,
                        attendees=10, **kw):
    start = start or (datetime.utcnow() + timedelta(days=3)).replace(microsecond=0)
    end = end or (start + timedelta(hours=2))
    b = Booking(
        id=uuid.uuid4(),
        asset_id=asset.id,
        user_id=user.id,
        state=state,
        start_time=start,
        end_time=end,
        attendee_count=attendees,
        reference=f"ATR-TEST-{uuid.uuid4().hex[:6].upper()}",
        **kw,
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b


@pytest.fixture
def make():
    return SimpleNamespace(user=_make_user, asset=_make_asset, booking=_make_booking)
