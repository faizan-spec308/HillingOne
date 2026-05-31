from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import SessionLocal
from app.services import ai_agent_service
from app.routers import ai_agent, bookings, categories, facilities, slots, users

tags_metadata = [
    {
        "name": "AI Agent",
        "description": (
            "Natural language search and agentic booking powered by Google Gemini. "
            "Submit a free-text request and get back confidence-scored facility suggestions, "
            "or let the agent resolve intent, find a slot, and create a booking in one call."
        ),
    },
    {
        "name": "Bookings",
        "description": (
            "Create, retrieve, update, and cancel bookings. "
            "Slots are locked atomically on creation to prevent double-booking."
        ),
    },
    {
        "name": "Facilities",
        "description": "Browse and search all 50 bookable council assets across 10 categories.",
    },
    {
        "name": "Slots",
        "description": "Query available time slots for a specific facility or an entire service category.",
    },
    {
        "name": "Categories",
        "description": "10 service categories: Community Halls, Sports, Meeting Rooms, Parks, Equipment Hire, Registry, Housing, Benefits, Libraries, and Youth Centres.",
    },
    {
        "name": "Users",
        "description": "Resident and staff user management. Roles: resident | staff | admin.",
    },
    {
        "name": "Health",
        "description": "Service health and version information.",
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = SessionLocal()
    try:
        ai_agent_service.load_facilities_cache(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="HillingOne API",
    description=(
        "AI-powered unified booking platform for the London Borough of Hillingdon. "
        "Residents search in plain English; Gemini matches, ranks, and books the right facility. "
        "\n\n"
        "Built at the **Hillingdon × Brunel University Hackathon** · April 2026 · 🥉 3rd Place  \n"
        "Presented to Microsoft, Hillingdon Council officers, and ICS.AI."
    ),
    version="1.0.0",
    openapi_tags=tags_metadata,
    contact={"name": "Team Falcon — Brunel University London"},
    license_info={"name": "All rights reserved — Team Falcon, Brunel University London"},
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api"
app.include_router(categories.router, prefix=PREFIX)
app.include_router(facilities.router, prefix=PREFIX)
app.include_router(slots.router, prefix=PREFIX)
app.include_router(bookings.router, prefix=PREFIX)
app.include_router(users.router, prefix=PREFIX)
app.include_router(ai_agent.router, prefix=PREFIX)


@app.get("/", tags=["Health"])
def root():
    """Service info and link to Swagger documentation."""
    return {
        "service": "HillingOne API",
        "version": "1.0.0",
        "docs": "/docs",
        "status": "running",
    }


@app.get("/health", tags=["Health"])
def health():
    """Lightweight health check for load balancers and deployment platforms."""
    return {"status": "healthy"}
