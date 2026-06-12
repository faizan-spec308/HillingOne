# HillingOne

**The intelligent agentic front door for Hillingdon Council community bookings.**

Live at [hilling-one.vercel.app](https://hilling-one.vercel.app)

---

## What it is

HillingOne replaces the fragmented landscape of Hillingdon Council booking interfaces with a single, production-ready platform. Residents search and book community assets in plain English. Staff manage the full asset lifecycle. An autonomous AI agent resolves booking conflicts without human intervention.

- **Backend:** Python FastAPI + SQLAlchemy 2.0 async + Neon PostgreSQL, deployed on Render (Docker)
- **Frontend:** React 18 + Vite + Tailwind CSS, deployed on Vercel
- **AI:** Gemini 2.5 Flash with native function calling (genuine agentic AI)
- **Payments:** Stripe (PaymentIntent, partial refunds, recurring billing)

---

## Features

### Resident

- **Natural language search** — type "room for 20 children Tuesday afternoon Hayes with kitchen" and get ranked, scored results
- **Live availability calendar** — week view with slot-level availability, keyboard accessible
- **Hold & confirm flow** — 5-minute hold with countdown timer, Stripe payment on confirm
- **Recurring bookings** — weekly series with per-occurrence pricing based on live sibling count
- **My Bookings** — tab-filtered view (upcoming / past / cancelled) with total bookings and hours booked
- **Reschedule** — move a confirmed booking to a new slot with automatic upcharge/refund via Stripe
- **Swap responses** — accept or decline staff-proposed slot swaps with credit offers
- **ICS download** — calendar invite for any confirmed booking
- **Email notifications** — booking confirmation, cancellation, swap proposal, and password reset
- **Multi-language** — EN + additional locales via LanguageContext
- **Dark mode** — full dark theme across all views, toggled from Settings

### Staff

- **Dashboard** — live metrics: total bookings, active assets, pending decisions, today's bookings
- **Asset utilisation table** — real hours-booked vs available hours (84h/week), colour-coded utilisation bands
- **Decision queue** — pending swap requests awaiting staff action
- **Asset management** — create, edit, enable/disable assets with full metadata (capacity, amenities, accessibility, ward, image)
- **Override flow** — Tier 3 cancellation with mandatory reason, automatic resident notification, and audit log entry

### Agentic AI — Conflict Resolution Agent

When a high-priority booking conflicts with an existing confirmed booking, the agent runs autonomously:

1. `search_inventory` — find candidate alternatives in the same ward
2. `check_availability` — verify each candidate is free
3. `score_alternative` — rate match quality (capacity, amenities, location)
4. `send_swap_request` — propose a polite swap to the resident with a credit offer
5. `escalate_to_staff` — if no good alternative exists
6. `log_decision` — write every step to the audit trail

The Agent Reasoning Panel streams each step live. A deterministic fallback runs identical logic if the Gemini API is unavailable.

### Four-tier cancellation model

| Tier | When | What happens |
|------|------|--------------|
| 1 | Resident cancels their own booking | Always allowed; Stripe refund issued |
| 2 | Agent-mediated swap | Agent proposes alternative + credit. Resident decides. |
| 3 | Legitimate operational override | Staff cancels with documented reason; alternative offered; full audit |
| 4 | Force majeure | System cancels; alternatives proposed; full audit |

**Staff get priority on availability. Residents get priority on certainty.**

---

## Security

- JWT authentication on every endpoint — `user_id` is always read from the token, never the request body
- Stripe webhook signature verification — unsigned events are rejected
- `SELECT FOR UPDATE` row-level locking — prevents double-booking and double-refund race conditions
- Pydantic v2 validation — UUID types, `EmailStr`, `min_length`/`max_length` on all inputs
- Security response headers — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS in production
- Email template XSS prevention — all user-supplied values escaped via `html.escape()`
- Rate limiting via SlowAPI
- bcrypt password hashing with strength policy (min 8 chars, uppercase + digit required)
- Admin secret in `X-Admin-Secret` header (never in request body)
- `/docs` and `/redoc` disabled in production

---

## Running locally

### Prerequisites

- Docker & Docker Compose
- Node.js 18+
- A Gemini API key (free at [aistudio.google.com](https://aistudio.google.com))
- A Stripe account (test keys work)

### Step 1: Configure environment

```bash
cd atrium/backend
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=postgresql+asyncpg://...   # your Postgres connection string
JWT_SECRET=<random 32+ char string>
GEMINI_API_KEY=<your key>
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
ADMIN_SECRET=<secret for creating staff accounts>
ENVIRONMENT=development
```

### Step 2: Start the backend

```bash
docker compose up
```

This starts PostgreSQL, runs all Alembic migrations, seeds 25 real Hillingdon assets and demo users, and starts FastAPI on `http://localhost:8000`.

### Step 3: Start the frontend

```bash
cd atrium/frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

---

## API reference

```
GET    /health                                 Health check
POST   /api/auth/register                      Register resident account
POST   /api/auth/login                         Login → JWT
POST   /api/auth/logout                        Invalidate token
POST   /api/auth/create-staff                  Create staff/councillor (X-Admin-Secret required)
POST   /api/auth/forgot-password               Send password reset email
POST   /api/auth/reset-password                Confirm password reset

GET    /api/search                             Natural language search + availability ranking

GET    /api/bookings                           List authenticated user's bookings (paginated)
POST   /api/bookings/hold                      Create 5-minute held booking
POST   /api/bookings/{id}/confirm              Confirm and pay
DELETE /api/bookings/{id}                      Cancel (Stripe refund issued)
PATCH  /api/bookings/{id}/reschedule           Propose reschedule
POST   /api/bookings/{id}/reschedule/confirm   Pay upcharge / receive refund
POST   /api/bookings/{id}/swap-accept          Accept agent-proposed swap
POST   /api/bookings/{id}/swap-decline         Decline swap (original booking stays)
GET    /api/bookings/{id}/ics                  Download .ics calendar invite
GET    /api/bookings/{id}                      Get single booking

POST   /api/payments/create-intent             Create Stripe PaymentIntent
POST   /api/payments/webhook                   Stripe webhook (signature verified)
POST   /api/payments/refund/{booking_id}       Staff: issue full refund

POST   /api/agent/conflict-resolution          Trigger Conflict Resolution Agent
GET    /api/agent/runs/recent                  Recent agent run history
GET    /api/agent/runs/{run_id}                Single agent run detail

GET    /api/staff/dashboard                    Dashboard metrics + utilisation + decision queue
POST   /api/staff/override                     Tier 3 override with audit

GET    /api/assets                             List all active assets
POST   /api/assets                             Create asset (staff only)
PATCH  /api/assets/{id}                        Update asset (staff only)
PATCH  /api/assets/{id}/toggle                 Enable/disable asset (staff only)
GET    /api/assets/{id}/availability           Slot availability for a date range

GET    /api/reminders/all                      List scheduled reminders
```

---

## Project structure

```
atrium/
├── backend/
│   ├── app/
│   │   ├── agents/          # Conflict Resolution Agent (Gemini function calling)
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── routers/         # FastAPI route handlers
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic (booking, email, reminder)
│   │   ├── config.py        # Pydantic Settings
│   │   ├── dependencies.py  # get_current_user, require_staff
│   │   └── main.py          # App entry point, middleware, lifespan
│   ├── alembic/             # Database migrations (0001 → 0006)
│   └── Dockerfile
└── frontend/
    ├── src/
    │   ├── api/             # client.js — typed API wrapper
    │   ├── components/      # AssetCard, AssetCalendar, Header, Footer, SearchBox
    │   ├── context/         # AuthContext, ThemeContext, LanguageContext
    │   └── views/           # ResidentView, StaffView, MyBookings, SettingsView, AuthPage
    └── vite.config.js
```

---

## Demo accounts

After seeding, the following accounts are available locally:

| Email | Password | Role |
|-------|----------|------|
| `resident@hillingdon.gov.uk` | `Password1` | Resident |
| `staff@hillingdon.gov.uk` | `Password1` | Staff |
| `councillor@hillingdon.gov.uk` | `Password1` | Councillor |
