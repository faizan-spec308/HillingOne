# HillingOne

> **The intelligent agentic front door for Hillingdon Council bookings.**

[![CI](https://github.com/faizan-spec308/HillingOne/actions/workflows/ci.yml/badge.svg)](https://github.com/faizan-spec308/HillingOne/actions/workflows/ci.yml)

Built at the **Hillingdon × Brunel University London Hackathon** · 29 April 2026 · Battle of Britain Bunker, Uxbridge  
**Team Falcon · Brunel University London · 🥉 3rd Place**

Presented to: **Microsoft** · **Hillingdon Council senior officers** · **ICS.AI**

---

## What it does

The London Borough of Hillingdon manages bookable assets across 17 separate systems — community halls, sports facilities, meeting rooms, parks, equipment, registry services, and more. Residents phone multiple numbers and often abandon the process entirely.

HillingOne is a unified AI-powered platform that brings every council bookable asset into one intelligent interface. Residents describe what they need in plain English and the system finds the right facility, shows availability, and completes the booking in seconds. Staff get a single dashboard with real-time visibility, utilisation analytics, and AI-generated operational recommendations.

**One borough. One front door.**

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite + TailwindCSS | React 18.3 |
| Backend | Python FastAPI | 0.136.1 |
| AI Agents | Google Gemini (search + function calling) | google-genai 1.73 |
| Database | PostgreSQL | 16+ |
| ORM | SQLAlchemy | 2.0.49 |
| API Docs | Swagger / OpenAPI (auto-generated) | `/docs` |
| Config | pydantic-settings + python-dotenv | 2.14 / 1.2 |
| CI/CD | GitHub Actions | — |
| Deployment | Render (via `render.yaml`) | — |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                React Frontend  (atrium/frontend)                 │
│                    Vite · TailwindCSS · Leaflet                  │
└─────────────────────────────┬────────────────────────────────────┘
                              │  HTTP / REST
         ┌────────────────────┴──────────────────────┐
         │                                           │
┌────────▼───────────┐                  ┌────────────▼────────────┐
│  FastAPI REST API  │                  │  Atrium Async API       │
│  (main.py / app/)  │                  │  (atrium/backend/)      │
│                    │                  │                         │
│  /api/categories   │                  │  Conflict Agent         │
│  /api/facilities   │                  │  Async SQLAlchemy       │
│  /api/slots        │                  │  Alembic migrations     │
│  /api/bookings     │                  │  Reminder service       │
│  /api/users        │                  └────────────┬────────────┘
│  /api/ai/search    │                               │
│  /api/ai/book      │            ┌──────────────────▼──────────────┐
└────────┬───────────┘            │  Google Gemini                  │
         │                       │  (search matching + function     │
         │                       │   calling for autonomous agents) │
         └──────────┐            └─────────────────────────────────┘
                    │
          ┌─────────▼──────────┐
          │    PostgreSQL       │
          │  hillingdon_booking │
          │                    │
          │  categories (10)   │
          │  facilities (50)   │
          │  time_slots (~2100)│
          │  users (8)         │
          │  bookings          │
          └────────────────────┘
```

**Resident booking flow:**

1. Resident types (or speaks) a free-text request in the React UI
2. Frontend sends `POST /api/ai/search` to the FastAPI backend
3. Backend packages the request with the full facility catalogue and calls Gemini
4. Gemini returns structured JSON — facility matches with confidence scores (0–100)
5. Confidence ≥ 85 → auto-routes to top match. Below 85 → resident picks from options
6. Resident confirms → `POST /api/ai/book` → agent resolves date/time → slot locked → booking confirmed

---

## API Endpoints

Full interactive documentation at [`http://localhost:8000/docs`](http://localhost:8000/docs) (Swagger UI).

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | All 10 service categories with icons and descriptions |

### Facilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/facilities` | List active facilities — filter by `category_id`, `location`, `min_capacity`, `parking`, `accessibility` |
| GET | `/api/facilities/search?q=` | Full-text search across name, description, and location |
| GET | `/api/facilities/{id}` | Full details for a single facility |

### Time Slots
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/slots?facility_id=` | Available slots for a facility; optionally filter by date |
| GET | `/api/slots/available?category_id=` | All available slots across an entire category within a date range |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bookings` | Create a booking — atomically locks the time slot to prevent double-booking |
| GET | `/api/bookings?user_id=` | All bookings for a resident |
| GET | `/api/bookings/all` | Staff dashboard: all bookings with optional status and facility filters |
| PATCH | `/api/bookings/{id}` | Update booking status (`pending` → `confirmed`, any → `cancelled`) |
| DELETE | `/api/bookings/{id}` | Cancel booking and release the slot |

### AI Agent
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/search` | Natural language facility search — returns up to 3 confidence-scored suggestions |
| POST | `/api/ai/book` | Full agentic booking — parse intent, find slot, create booking in one call |

---

## The Four AI Agents

HillingOne is built around four autonomous AI agents using Google Gemini. Each agent receives a goal, has access to real database tools, and decides for itself what to do next.

### 1 — Booking Search Agent &nbsp;`POST /api/ai/search`

Translates a free-text resident request into ranked facility matches. The agent reads the entire facilities catalogue, identifies the best matches by type, location, capacity, and amenities, and returns up to 3 suggestions with confidence scores. Below 40% confidence it returns clarification options instead of guessing.

**Example request:**
```json
{
  "query": "I need a hall for my daughter's birthday party, about 80 people, Hayes with parking"
}
```

**Example response:**
```json
{
  "suggestions": [
    {
      "facility_id": 3,
      "name": "Hayes Community Hall",
      "confidence": 94.5,
      "reason": "Community hall in Hayes, capacity 150 suits 80 guests, has on-site parking",
      "available_slots": [{"slot_id": 123, "date": "2026-06-07", "start_time": "13:00", "end_time": "16:00"}]
    }
  ],
  "ai_message": "I found 3 venues that could work for your daughter's birthday party...",
  "needs_clarification": false
}
```

### 2 — Booking Completion Agent &nbsp;`POST /api/ai/book`

Given a natural language booking request, the agent resolves relative dates (`next Saturday`, `tomorrow morning`), identifies time preferences, finds the next available matching slot in PostgreSQL, creates the booking record, locks the slot atomically, and returns a confirmed reference — all in a single API call.

### 3 — Conflict Resolution Agent &nbsp;*(atrium/backend — Gemini native function calling)*

The most sophisticated agent. Uses Gemini 2.5 Flash with a declared tool schema for genuine function calling. When a high-priority booking conflicts with an existing confirmed booking, the agent autonomously runs a tool loop:

| Step | Tool | Action |
|------|------|--------|
| 1 | `search_inventory` | Query all assets by ward, capacity, category, accessibility |
| 2 | `check_availability` | Verify each candidate is free during the target window |
| 3 | `score_alternative` | Rate each candidate 0–100 against original requirements |
| 4 | `send_swap_request` | Draft a personalised message; offer 20% goodwill credit |
| 5 | `log_decision` | Write an immutable audit trail entry |

The agent suggests. The human decides. Declining is always honoured.

### 4 — Intent & Match Parser &nbsp;*(atrium/backend)*

Parses natural language into structured intent (facility type, capacity, accessibility, ward), then ranks candidate assets against that intent using Gemini. Falls back to deterministic rule-based matching when the API is unavailable — ensuring the demo works offline.

---

## Database Schema

| Table | Rows | Purpose |
|-------|------|---------|
| `categories` | 10 | Community Halls, Sports, Meeting Rooms, Parks, Equipment Hire, Registry, Housing, Benefits, Libraries, Youth |
| `facilities` | 50 | Bookable assets across real Hillingdon locations (Hayes, Uxbridge, Ruislip, Northwood…) |
| `time_slots` | ~2,100 | 14 days × 3 slots/day × 50 facilities; ~150 pre-booked for realistic demo data |
| `users` | 8 | 4 staff + 4 residents with role-based access (resident / staff / admin) |
| `bookings` | varies | HBC-2026-XXXX references, status, AI suggestion flag, confidence score |

Database views: `available_slots`, `booking_dashboard`, `facility_stats` (utilisation percentages per facility).

---

## Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 16+
- Node.js 20+ (React frontend)
- Google Gemini API key — [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### 1 — Clone and configure

```bash
git clone https://github.com/faizan-spec308/HillingOne.git
cd YOUR_REPO
cp .env.example .env
# Edit .env — fill in GEMINI_API_KEY and DB_PASSWORD
```

Also copy the atrium backend env:

```bash
cp atrium/backend/.env.example atrium/backend/.env   # if it exists
# or copy .env.example content — same variables
```

### 2 — Install Python dependencies

```bash
python -m venv venv
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows

pip install -r requirements.txt
```

### 3 — Set up the databases

**Main booking database** (powers the REST API and Swagger docs):

```bash
psql -U postgres -c "CREATE DATABASE hillingdon_booking;"
psql -U postgres -d hillingdon_booking -f schema.sql
```

`schema.sql` creates 5 tables, seeds 50 facilities, generates 30 days of time slots, and inserts 8 demo users and 8 sample bookings.

**Atrium database** (powers the frontend and AI agents):

```bash
psql -U postgres -c "CREATE USER atrium WITH PASSWORD 'atrium';"
psql -U postgres -c "CREATE DATABASE atrium OWNER atrium;"
cd atrium/backend
python -m alembic upgrade head
python -m app.seed.seed_data    # seeds 25 assets, 6 users, 60 bookings
cd ../..
```

### 4 — Install frontend dependencies

```bash
cd atrium/frontend
npm install
cd ../..
```

### 5 — Start everything (Windows)

```bat
start.bat
```

This single script kills any existing process on port 8000, starts the atrium backend with `--reload`, and opens the React dev server — each in its own terminal window.

**Or start manually:**

```bash
# Terminal 1 — atrium backend (what the frontend talks to)
cd atrium/backend
uvicorn app.main:app --port 8000 --reload

# Terminal 2 — React frontend
cd atrium/frontend
npm run dev

# Terminal 3 — main REST API Swagger docs (optional, different port)
uvicorn main:app --port 8001 --reload
```

| URL | What it is |
|-----|-----------|
| [http://localhost:5173](http://localhost:5173) | React frontend |
| [http://localhost:8000/docs](http://localhost:8000/docs) | Atrium API — Swagger UI |
| [http://localhost:8001/docs](http://localhost:8001/docs) | Main booking API — Swagger UI (optional) |
| [(https://hilling-one.vercel.app/)]((https://hilling-one.vercel.app/)) | Deployed Vercel Version |


### 6 — Conversational demo (optional)

```bash
pip install streamlit
streamlit run app.py
```

---

## Environment Variables

### Root `.env` — main FastAPI backend

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `DB_HOST` | No | PostgreSQL host (default: `localhost`) |
| `DB_PORT` | No | PostgreSQL port (default: `5432`) |
| `DB_NAME` | No | Database name (default: `hillingdon_booking`) |
| `DB_USER` | No | PostgreSQL username (default: `postgres`) |
| `DB_PASSWORD` | Yes | PostgreSQL password |

### `atrium/backend/.env` — atrium backend + frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://atrium:atrium@localhost:5432/atrium` | Async database URL |
| `GEMINI_API_KEY` | — | Same key as above |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model for agents |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed frontend origins |
| `HOLD_DURATION_SECONDS` | `60` | How long a slot hold lasts |
| `DEFAULT_GOODWILL_CREDIT_PERCENTAGE` | `20` | Credit % offered on conflict swaps |

---

## Project Structure

```
HillingOne/
├── start.bat                     # One-command dev startup (Windows)
├── main.py                       # FastAPI application entry point
├── app.py                        # Streamlit conversational AI demo
├── requirements.txt              # Python dependencies (pinned)
├── render.yaml                   # One-click Render deployment config
├── .env.example                  # Environment variable template
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI pipeline
│
├── app/                          # FastAPI application package
│   ├── config.py                 # Settings loaded from environment variables
│   ├── database.py               # SQLAlchemy engine and session factory
│   ├── models.py                 # ORM models (5 tables)
│   ├── schemas.py                # Pydantic request / response schemas
│   ├── routers/                  # One router module per resource
│   │   ├── categories.py
│   │   ├── facilities.py
│   │   ├── slots.py
│   │   ├── bookings.py
│   │   ├── users.py
│   │   └── ai_agent.py
│   ├── services/
│   │   ├── ai_agent_service.py   # Gemini integration, in-memory facility cache
│   │   └── booking_service.py    # Booking business logic and slot locking
│   └── utils/
│       └── helpers.py            # Unique reference number generation
│
└── atrium/                       # Advanced agentic system
    ├── backend/                  # Async FastAPI + Gemini function calling
    │   └── app/
    │       ├── agents/           # Conflict Resolution Agent (function calling)
    │       ├── models/           # Async SQLAlchemy models + state machines
    │       ├── routers/          # 7 API routers (search, bookings, agent, staff…)
    │       └── services/         # Gemini client, booking service, reminders
    └── frontend/                 # React 18 + Vite + TailwindCSS
        └── src/
            ├── components/
            └── views/
```

---

## Deployment

The backend deploys to [Render](https://render.com) in one click:

1. Fork this repository
2. Connect it to Render as a new Web Service
3. Render detects `render.yaml` automatically
4. Add `GEMINI_API_KEY` and database credentials in the Render dashboard
5. Deploy

The `render.yaml` configures the Python environment, `uvicorn main:app` start command, and the `/health` health check endpoint.

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request to `main`:

| Job | What it checks |
|-----|----------------|
| Backend lint | `ruff check` across `app/` and `main.py` |
| Backend import check | All modules import cleanly with no live database |
| Frontend build | `npm ci && npm run build` in `atrium/frontend` |

A green ✓ badge confirms the code is syntactically valid, all modules resolve, and the React bundle compiles.

---

## Security

- All secrets loaded from environment variables — no hardcoded credentials in source
- SQL injection prevented via SQLAlchemy ORM parameterised queries
- Input validated on every endpoint via Pydantic schemas
- Prompt injection protection — user input is isolated from AI system prompts
- CORS configured; restrict `allow_origins` to your frontend domain in production
- `.env` excluded from version control via `.gitignore`

---

## The Trust Contract

**Staff get priority on availability.** When a slot is open, council staff and councillors can claim it instantly.

**Residents get priority on certainty.** Once a booking is confirmed, it is protected. It can only be cancelled by the resident themselves, or by staff for a documented operational reason — with full transparency, an alternative offered, and a goodwill credit applied.

| Tier | Type | How it works |
|------|------|-------------|
| 1 | User cancellation | The resident cancels their own booking. Always allowed. |
| 2 | Agent-mediated swap | Conflict agent finds alternatives and asks the resident. Decline is honoured. |
| 3 | Operational override | Staff cancel with a documented reason. Resident notified, alternative offered, 20% credit applied. |
| 4 | Force majeure | Building-wide closure. System cancels, agent finds alternatives, applies credits. |

---

## Built by

Built by Faizan Naveed at the Hillingdon x Brunel University Hackathon, 29 April 2026, Battle of Britain Bunker, Uxbridge. Presented to Microsoft, Hillingdon Council senior officers, and ICS.AI. 3rd Place.

**🥉 3rd Place**

---

*The agent suggests. The human decides.*
