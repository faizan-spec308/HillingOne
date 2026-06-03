"""Atrium FastAPI application entry point."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import search, bookings, agent, staff, assets, reminders, demo, payments


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Atrium",
    description="The intelligent agentic front door for Hillingdon Council bookings.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router)
app.include_router(bookings.router)
app.include_router(payments.router)
app.include_router(agent.router)
app.include_router(staff.router)
app.include_router(assets.router)
app.include_router(reminders.router)
app.include_router(demo.router)


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "atrium",
        "version": "1.0.0",
        "agentic_ai": "Conflict Resolution Agent (Gemini 2.5 Flash function calling)",
    }


@app.get("/")
async def root():
    return {
        "service": "Atrium",
        "tagline": "The intelligent agentic front door for Hillingdon Council bookings",
        "docs": "/docs",
        "health": "/health",
    }
