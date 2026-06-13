# HillingOne — Production Backlog

Captured so the work isn't lost. **None of these block the presentation demo** — they are
post-demo hardening. The four demo paths (resident book→confirm, My Bookings, staff
agent-resolve→swap, staff escalate→override) are the priority until after the presentation.

Tackle in roughly this order. Start with **tests** — without them, every change keeps
surfacing regressions by hand.

---

## P0 — Do first after the demo

### Automated tests (the biggest gap)
There are currently no automated tests, so every change is verified manually. Add:
- Backend: pytest for the booking state machine (hold → confirm → cancel/refund),
  the four-tier cancellation model, `accept_swap` / `decline_swap`, `staff_override`,
  and the agent's progressive search (`conflict_agent` fallback).
- A smoke test that exercises the full conflict cycle end to end.

### Security
- `POST /api/agent/conflict-resolution` is **unauthenticated**. Gate it behind
  `require_staff` (the staff `resolve-conflict` wrapper already is). Either lock it or remove
  the public route and only use the staff endpoint.
- Review rate limits on auth + agent endpoints.

---

## P1 — Correctness / robustness
- **Browser back button** (FIX-01): the booking flow uses manual `replaceState`, so Back can
  exit the app from a sub-stage. Needs a `pushState`/`popstate` approach tested live against
  React Router (the flow paths are real routes; naïve changes can remount and lose state).
- **Live Gemini path**: less predictable than the deterministic fallback (latency, occasional
  non-completion). For reliability, demo with the fallback (empty `GEMINI_API_KEY`); for
  production, add ret/guard around the model loop.
- **Swap payment**: `accept_swap` now carries the payment across to the new booking. Confirm
  this matches finance expectations (vs. refund-and-recharge) and handles price differences
  between venues.

## P2 — Config / ops
- **Emails** only send when `RESEND_API_KEY` is set (otherwise skipped, logged). Set it in
  production so confirmation/cancellation/swap emails actually go out.
- **Refunds** only fire when `STRIPE_SECRET_KEY` is set and a succeeded `Payment` exists.
- Ensure `JWT_SECRET`, `ADMIN_SECRET`, `STRIPE_WEBHOOK_SECRET`, `ENVIRONMENT=production` are
  set in the deployed env.

## P3 — UX backlog (from the earlier audit)
Reasonable enhancements, none broken today:
- Booking-flow step indicator (1–5)
- AssetCalendar mobile layout (7-col table is cramped < 640px)
- Example-query chips populate the box instead of auto-submitting
- MyBookings stats placement / filter-reactive stats
- Calendar opens on the requested week, not the current one
- Copy-to-clipboard on booking reference
- New-user onboarding hint
- Rename internal terms for residents ("swap pending" → "venue change proposed")

## P4 — Maintenance
- The `.dark { ... !important }` layer in `index.css` still maps Tailwind semantic utilities
  (`bg-red-50`, `text-gray-*`) for dark mode. It works and is intentional, but migrating the
  remaining semantic utilities to tokens would let it be deleted.
- Move shared constants (wards, categories) fully onto `src/lib/constants.js` everywhere
  (StaffView/SettingsView still hold local copies).

---

## Already addressed this cycle (for reference)
- Agent tries progressively harder before escalating; best-of-N candidate scoring.
- Agent-run status fixed (a proposed swap is a success, not "failed").
- Decision Queue history (resident accepted / kept / staff overridden).
- Refund + goodwill credit + email + in-app notification wired across all cancel/swap flows.
- `accept_swap` re-checks the alternative is still free before moving the resident.
- Full design-token system; refined-premium UI pass.
