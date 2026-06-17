# HillingOne — Demo Run-Sheet

Rehearse this end to end. The flow is **deterministic** — you create the booking you
demo on, so the agent always proposes the same swap (Hayes End → Charville, same ward).

---

## Pre-flight (once, before you present)
- [ ] Deployed URL loads; Vercel build is green
- [ ] Backend env: `JWT_SECRET` set; **`GEMINI_API_KEY` empty** (reliable 5-step agent) — or set it for the live-AI story (it auto-falls back if it stalls)
- [ ] (Optional) `RESEND_API_KEY` + `STRIPE_SECRET_KEY` (test) if you want emails/refunds to *visibly* fire. If Stripe is **off**, bookings confirm instantly with no card — smoother demo.
- [ ] Two browser windows side by side: **Window A = Staff**, **Window B = Resident** (use a private/incognito window for one so you don't get logged out)

## Logins (seeded)
| Role | Email | Password |
|------|-------|----------|
| Resident (Hayes Town) | `aisha.khan@example.com` | `Resident2026!` |
| Staff | `sarah.patel@hillingdon.gov.uk` | `Staff2026!` |
| Councillor (optional) | `cllr.smith@hillingdon.gov.uk` | `Staff2026!` |

---

## The demo (≈5–6 min)

### ① Resident books — "plain English → AI match" (Window B, ~60s)
1. Log in as **Aisha** (resident).
2. Search box, type: **"community hall in Hayes for 10 people next Saturday afternoon, with a kitchen"**
3. In results, pick **Hayes End Community Centre** → **Book**.
4. Set: **next Saturday, 14:00–16:00**, **10 attendees**, **Repeat booking OFF**.
5. **Hold this space** → **Confirm** (Stripe test card `4242 4242 4242 4242` if Stripe is on; otherwise it confirms instantly).
6. Land on the confirmation page — point out **reference (ATR-…)**, *Add to calendar*, and the *"your booking, protected"* trust panel. **Note the reference.**

> Talking point: "One front door, plain-English search, instant confirmation — replacing 17 systems."

### ② Show it's real (Window B, ~15s)
- **My Bookings** → the Hayes End booking is **Confirmed**. (Bell notification appears within ~20s.)

### ③ The conflict — the AI agent (Window A, ~90s) — **the wow**
1. Log in as **Sarah** (staff) → **Staff Portal** → **Resolve Conflict** tab.
2. Search **"Hayes End"** (or paste the reference) → click the **confirmed** booking.
3. In the popup, priority need: **"Councillor needs Hayes End this Saturday afternoon for an emergency residents' meeting."**
4. **Run conflict agent.**
5. Green verdict: **"Agent proposed a swap to Charville Community Hall (Hayes Town) with a 20% goodwill credit."** Walk through the **reasoning trace**: searched inventory → checked availability → scored alternative → sent swap → logged decision.

> Talking point: "It didn't cancel anyone. It found a fair alternative, offered goodwill, and left the decision with the resident. The agent suggests; the human — and the resident — decide."

### ④ Resident keeps control (Window B, ~45s)
1. Back to **Aisha** → **My Bookings** → refresh.
2. The blue **swap proposal** card: alternative venue, 20% credit, **Accept** / **Keep my booking**.
3. **Accept** → booking moves to **Charville**, 20% credit applied, bell notification fires.
   - *(To show the trust guarantee instead, click **Keep** — the original booking stays confirmed. Pick one to click; mention the other.)*

### ⑤ Audit trail (Window A, ~30s)
- **Decision Queue → Recent decisions**: *"Resident accepted the swap — Charville…"*
- **AI Agent Runs** tab: the run shows green **"Swap proposed"** with the full reasoning.

> Talking point: "Every action logged. Every cancellation explained. Every resident offered an alternative."

### ⑥ When the AI can't — honest escalation + override (Window A, ~60s) *(optional)*
1. **Resolve Conflict** → search a **single-venue ward** booking. Easiest: in Window B, first book **Manor Farm Library Study Pod** (Manor ward — the only venue there), then resolve *that*.
2. **Run conflict agent** → amber **"Escalated"** with the specific reason ("no suitable alternative / all booked").
3. **Proceed with documented override** → reason **Room damage**, details *"Burst pipe — hall unusable, works order #4821."* → **Override & cancel**.
4. Resident is refunded (if Stripe on), credited 20%, and notified.

> Talking point: "It only escalates to a human when it genuinely can't help — and even then, the resident is protected: full refund, credit, alternative, notification."

---

## If something trips
- **Agent escalates when you wanted a swap:** the reasoning trace tells you why (usually capacity or the alternative was booked). Use a **small attendee count (10)** and **Hayes End** — that's why we control the booking.
- **Swap card not showing:** refresh My Bookings (it loads on navigation; the card is state-based, not the bell).
- **Bell empty:** wait ~20s or switch tabs and back (it refetches on focus).
- **Keep it non-recurring** — recurring bookings are intentionally blocked from the agent.

## Reset between rehearsals
Just create a fresh booking (steps ①). Each run uses a new booking, so no cleanup needed.

## One-line pitch to open/close with
*"HillingOne turns underused public spaces into well-run, fairly-allocated community assets — with an AI agent that resolves the booking conflicts councils still handle by phone and goodwill today."*
