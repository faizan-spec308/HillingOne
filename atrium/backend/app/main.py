"""HillingOne FastAPI application entry point."""
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.jwt_secret == "atrium-dev-secret-change-in-production":
        raise RuntimeError("JWT_SECRET is using the insecure default — set a real secret in your environment.")
    from app.database import engine
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.execute(text("SELECT 1"))
    logger.info("startup_ok environment=%s", settings.environment)
    yield


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
