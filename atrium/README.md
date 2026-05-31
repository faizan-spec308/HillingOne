# Atrium

**The intelligent agentic front door for Hillingdon Council's existing booking backend.**

Built for the Hillingdon × Brunel Hackathon, 29 April 2026.

---

## What this is

A complete, working application:
- **Backend:** Python FastAPI + PostgreSQL + SQLAlchemy async
- **Frontend:** React 18 + Vite + Tailwind + Leaflet
- **AI:** Gemini 2.5 Flash with native function calling (genuine agentic AI)
- **Deployment:** Docker Compose, one command to run

Until now, residents and staff have had to navigate **17 different fragmented interfaces**
to find what they need across Hillingdon's bookable assets. Atrium replaces those 17
frontends with one intelligent layer powered by an autonomous Conflict Resolution Agent.

---

## The four-tier cancellation model

This is what wins the trust criterion with council judges.

| Tier | When | What happens |
|------|------|--------------|
| 1. User cancellation | Resident cancels their own booking | Always allowed |
| 2. Agent-mediated swap | Staff/councillor wants a Confirmed slot | Agent ASKS resident with alternative + 20% credit. Resident decides. |
| 3. Legitimate operational override | Room damage, safety issue, mandatory closure, etc. | Staff CAN cancel, but must give documented reason, alternative offered, credit applied, full audit |
| 4. Force majeure | Building-wide emergency | System cancels, alternatives proposed, full audit |

**Staff get priority on availability. Residents get priority on certainty.**
**Trust is not built by saying never. It is built by saying always with transparency.**

---

## The agentic AI

The Conflict Resolution Agent is genuine agentic AI built with Gemini 2.5 Flash function calling.
It receives a goal, has 6 tools available, and autonomously decides which to call:

1. `search_inventory` — find candidate alternatives
2. `check_availability` — verify a candidate is free
3. `score_alternative` — rate how well it matches the original
4. `send_swap_request` — propose a polite swap with credit
5. `escalate_to_staff` — when no good alternative exists
6. `log_decision` — write to audit trail

Each step is captured and shown in the **Agent Reasoning Panel** on the frontend so judges
can watch the agent think live.

If the Gemini API key is missing or the call fails, a deterministic fallback runs the same
reasoning steps so the demo never breaks.

---

## How to run

### Step 1: Get a Gemini API key (free)

Go to https://aistudio.google.com → Get API key → copy it.

### Step 2: Configure environment

```bash
cp .env.example .env
# Edit .env and paste your Gemini key into GEMINI_API_KEY
```

### Step 3: Start everything

```bash
docker compose up
```

This will:
1. Start PostgreSQL
2. Run database migrations
3. Seed 25 real Hillingdon assets, 6 users, 60 mock bookings
4. Start the FastAPI backend on http://localhost:8000

### Step 4: Start the frontend (in a separate terminal)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

### Step 5: Open the app

Visit http://localhost:5173

---

## The demo flow

### Scenario 1: Resident books in plain English

1. Type or speak a request: "I need a room for 20 children every Tuesday afternoon in Hayes, with a kitchen"
2. Watch "Searching across 17 booking systems..." appear (this is the pitch line)
3. AI parses intent and shows a structured summary
4. 4 ranked matches appear with reasoning, carbon estimate, accessibility match
5. Click "Book this" → 60 second hold timer
6. Click "Confirm booking" → Confirmed and Protected
7. Note the trust panel underneath, the calendar invite button, the AI-written encouragement, and reminders scheduled

### Scenario 2: 🤖 The autonomous agent (the moment that wins)

1. Open the Demo Controller (bottom right)
2. Click "Run AGENT: Councillor swap"
3. The Agent Reasoning Panel slides in from the right
4. Watch each step appear live:
   - Step 1: searching inventory in Hayes Town
   - Step 2: checking availability of best candidate
   - Step 3: scoring the alternative
   - Step 4: sending polite swap request
   - Step 5: logging decision
5. Final decision: swap_proposed
6. The resident can now decline, and the booking will stay

### Scenario 3: Legitimate override

1. Click "Run override: flooded room"
2. Staff cancels a confirmed booking with reason "room_damage"
3. Resident automatically notified with full reason + alternative + 20% credit
4. Audit log entry created

---

## API endpoints

```
GET  /health                              Health check
POST /api/search                          Parse intent + rank matches
POST /api/bookings/hold                   Create 60s held booking
POST /api/bookings/{id}/confirm           Resident confirms
DELETE /api/bookings/{id}                 User cancels (Tier 1)
GET  /api/bookings/{id}/ics               Download calendar invite
POST /api/agent/conflict-resolution       Trigger autonomous agent
GET  /api/agent/runs/recent               Recent agent runs
POST /api/staff/override                  Tier 3 override
GET  /api/staff/dashboard                 Live agent feed + utilisation
GET  /api/assets                          List all assets
GET  /api/reminders/all                   List reminders
POST /api/demo/scenario/agent-swap-request    Run agent demo
POST /api/demo/scenario/legitimate-override   Run override demo
POST /api/demo/reset                      Reset demo state
```

Full API docs at http://localhost:8000/docs

---

## The pitch lines that win

> "Until now, residents and staff have had to navigate seventeen different booking interfaces to find what they need. We replaced those seventeen frontends with one intelligent agentic layer."

> "Staff get priority on availability. Residents get priority on certainty."

> "When a high-priority need arises, our agent runs autonomously. It searches the inventory, checks availability, scores alternatives, and crafts a personalised swap message. It calls real tools, observes results, and decides next actions. You can watch it think on screen right now."

> "Trust is not built by saying never. It is built by saying always with transparency."

> "The agent suggests. The human decides."

---

## Troubleshooting

**Backend can't connect to Postgres:** wait a few seconds, the healthcheck will resolve. Or run `docker compose down -v && docker compose up`.

**Gemini API errors:** check that GEMINI_API_KEY is set in `.env`. If it isn't, the deterministic fallback will run and the demo still works.

**Frontend can't reach backend:** make sure the backend is on port 8000. Check the `vite.config.js` proxy.

**Map doesn't render:** make sure Leaflet CSS is loaded (it is in `index.html`).

---

Built by Team Falcon, Brunel Computer Science. Good luck.
