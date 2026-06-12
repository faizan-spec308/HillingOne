"""HillingOne FastAPI application entry point."""
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter
from app.routers import search, bookings, agent, staff, assets, reminders, payments, auth

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("hillingone")


async def _booking_maintenance_loop() -> None:
    """Expire stale holds and complete finished bookings every minute."""
    from app.database import AsyncSessionLocal
    from app.services.booking_service import BookingService

    while True:
        try:
            async with AsyncSessionLocal() as db:
                svc = BookingService(db)
                expired = await svc.expire_holds()
                completed = await svc.complete_past_bookings()
                if expired or completed:
                    logger.info("maintenance holds_expired=%d bookings_completed=%d", expired, completed)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("booking_maintenance_failed")
        await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.jwt_secret == "atrium-dev-secret-change-in-production":
        raise RuntimeError("JWT_SECRET is using the insecure default — set a real secret in your environment.")
    from app.database import engine
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
    maintenance_task = asyncio.create_task(_booking_maintenance_loop())
    logger.info("startup_ok environment=%s", settings.environment)
    yield
    maintenance_task.cancel()
    try:
        await maintenance_task
    except asyncio.CancelledError:
        pass


_docs_url = None if settings.environment == "production" else "/docs"
_redoc_url = None if settings.environment == "production" else "/redoc"

app = FastAPI(
    title="HillingOne",
    description="The intelligent agentic front door for Hillingdon Council bookings.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Admin-Secret"],
)

app.include_router(auth.router)
app.include_router(search.router)
app.include_router(bookings.router)
app.include_router(payments.router)
app.include_router(agent.router)
app.include_router(staff.router)
app.include_router(assets.router)
app.include_router(reminders.router)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "hillingone",
        "version": "1.0.0",
        "agentic_ai": "Conflict Resolution Agent (Gemini 2.5 Flash function calling)",
    }


@app.get("/")
async def root():
    return {
        "service": "HillingOne",
        "tagline": "The intelligent agentic front door for Hillingdon Council bookings",
        "health": "/health",
    }
