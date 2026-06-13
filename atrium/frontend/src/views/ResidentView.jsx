import { useEffect, useState } from "react";
import { Sparkles, Network, ArrowLeft, Calendar, Clock, PoundSterling, RefreshCw, SearchX } from "lucide-react";
import SearchBox from "../components/SearchBox";
import AssetCard from "../components/AssetCard";
import AssetCalendar from "../components/AssetCalendar";
import BrowseView from "./BrowseView";
import BookingConfirmation from "./BookingConfirmation";
import PaymentForm from "../components/PaymentForm";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

const STAGE_PATHS = {
  search:    "/",
  browse:    "/browse",
  loading:   "/search",
  results:   "/results",
  datetime:  "/book",
  hold:      "/hold",
  payment:   "/pay",
  confirmed: "/confirmed",
};

export default function ResidentView({ user, onViewMyBookings }) {
  const { t } = useLanguage();
  const [stage, setStageRaw] = useState("search"); // search | loading | results | hold | payment | confirmed

  const setStage = (s) => {
    setStageRaw(s);
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    window.history.replaceState(null, "", base + (STAGE_PATHS[s] ?? "/"));
  };
  const [intent, setIntent] = useState(null);
  const [matches, setMatches] = useState([]);
  const [searchWindow, setSearchWindow] = useState(null);
  const [holding, setHolding] = useState(false);
  const [holdBooking, setHoldBooking] = useState(null);
  const [holdAsset, setHoldAsset] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [encouragement, setEncouragement] = useState(null);
  const [remindersCount, setRemindersCount] = useState(0);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(null);
  const [calendarAsset, setCalendarAsset] = useState(null);

  const handleSearch = async (query) => {
    setError(null);
    setStage("loading");
    try {
      const res = await api.search(query, user.id);
      setIntent(res.intent);
      setMatches(res.matches);
      setSearchWindow(res.search_window);
      setStage("results");
    } catch (err) {
      setError(err.message);
      setStage("search");
    }
  };

  // Step 1: user clicks Book → show datetime picker (optionally pre-filled from calendar)
  const handleBook = (asset, preStart, preEnd) => {
    setHoldAsset(asset);
    if (preStart && preEnd) {
      setSearchWindow({ start: preStart, end: preEnd });
    }
    setCalendarAsset(null);
    setStage("datetime");
  };

  // Step 2: user confirms date/time → create the hold
  const handleHold = async (startTime, endTime, isRecurring = false, recurrenceWeeks = 4) => {
    setHolding(true);
    try {
      const booking = await api.hold({
        asset_id: holdAsset.id,
        start_time: startTime,
        end_time: endTime,
        purpose: intent?.purpose_summary || "Booking via HillingOne",
        attendee_count: intent?.capacity || null,
        is_recurring: isRecurring,
        recurrence_weeks: isRecurring ? recurrenceWeeks : null,
      });
      setHoldBooking(booking);
      setStage("hold");
    } catch (err) {
      setError(err.message);
    } finally {
      setHolding(false);
    }
  };

  const handleProceedToPayment = async () => {
    setError(null);
    try {
      const res = await api.createPaymentIntent(holdBooking.id);
      if (res.free) {
        // Free venue — nothing to pay, confirm straight away
        await handleConfirm();
        return;
      }
      setClientSecret(res.client_secret);
      setPaymentAmount(res.amount_display);
      setStage("payment");
    } catch (err) {
      if (err.status === 503 && err.message?.includes("Stripe not configured")) {
        // Server explicitly says Stripe is disabled — confirm without payment
        await handleConfirm();
        return;
      }
      // Real failure (network error, Stripe outage, etc.) — keep user on hold screen
      setError(err.message);
    }
  };

  const handleConfirm = async () => {
    try {
      const res = await api.confirm(holdBooking.id, true);
      setConfirmed(res);
      setEncouragement(res.encouragement || null);
      setRemindersCount(res.reminders_scheduled || 0);
      setStage("confirmed");
    } catch (err) {
      setError(err.message);
    }
  };

  const reset = () => {
    setStage("search");
    setIntent(null);
    setMatches([]);
    setHoldBooking(null);
    setHoldAsset(null);
    setConfirmed(null);
    setError(null);
    setClientSecret(null);
    setPaymentAmount(null);
  };

  /* ── Loading state ─────────────────────────────────────────────────────── */
  if (stage === "loading") {
    const skBg  = "var(--bg-card)";
    const skBdr = "var(--border)";
    const skEl  = "var(--surface-2)";
    return (
      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-hillingdon-navy text-white rounded-full text-sm font-semibold pulse-subtle mb-6">
            <Network size={15} />
            {t("results_loading_label")}
          </div>
          <p className="text-[15px]" style={{ color: "var(--text-2)" }}>
            {t("results_loading_sub")}
          </p>
        </div>

        {/* Skeleton cards */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl p-5 flex gap-4" style={{ background: skBg, border: `1px solid ${skBdr}` }}>
              <div className="w-[72px] h-[72px] rounded-xl flex-shrink-0 animate-pulse" style={{ background: skEl }} />
              <div className="flex-1 space-y-3 py-1">
                <div className="h-3 w-24 rounded animate-pulse" style={{ background: skEl }} />
                <div className="h-5 w-48 rounded animate-pulse" style={{ background: skEl }} />
                <div className="h-2 w-full rounded animate-pulse" style={{ background: skEl }} />
                <div className="h-2 w-3/4 rounded animate-pulse" style={{ background: skEl }} />
                <div className="flex gap-2 pt-1">
                  <div className="h-6 w-20 rounded-full animate-pulse" style={{ background: skEl }} />
                  <div className="h-6 w-16 rounded-full animate-pulse" style={{ background: skEl }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Results state ─────────────────────────────────────────────────────── */
  if (stage === "results") {
    const t1 = "var(--text-1)";
    const t2 = "var(--text-2)";
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 fade-in-up">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-[13px] hover:text-teal-600 mb-6 transition font-medium"
          style={{ color: t2 }}
        >
          <ArrowLeft size={15} />
          {t("results_new_search")}
        </button>

        {/* Intent panel */}
        {intent?.extracted_summary && (
          <div
            className="rounded-2xl p-5 mb-6 border"
            style={{ background: "var(--info-bg)", borderColor: "var(--info)" }}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-hillingdon-navy flex items-center justify-center flex-shrink-0">
                <Sparkles size={15} className="text-white" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--info)" }}>
                  {t("results_understood")}
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: t1 }}>{intent.extracted_summary}</p>
                {intent.follow_up_question && (
                  <p className="mt-2 text-[14px] font-semibold" style={{ color: t1 }}>
                    ✦ {intent.follow_up_question}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] font-medium" style={{ color: t2 }}>
            {matches.length} {matches.length === 1 ? t("results_match") : t("results_matches")}
          </p>
        </div>

        {matches.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ background: "var(--bg-card)", border: `1px solid ${"var(--border)"}` }}>
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--surface-2)", color: "var(--text-3)" }}>
              <SearchX size={26} strokeWidth={1.8} />
            </div>
            <h3 className="text-[16px] font-bold mb-2" style={{ color: t1 }}>{t("results_none")}</h3>
            <p className="text-[14px] mb-6" style={{ color: t2 }}>
              {t("results_none_sub")}
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <button onClick={reset} className="btn-primary">
                {t("results_search_again")}
              </button>
              <button onClick={() => setStage("browse")} className="btn-secondary">
                Browse all spaces
              </button>
            </div>
          </div>
        ) : (
          <>
            {calendarAsset && (
              <AssetCalendar
                asset={calendarAsset}
                onClose={() => setCalendarAsset(null)}
                onSelectSlot={handleBook}
              />
            )}
            <div className="space-y-4">
              {matches.map((m, i) => (
                <div key={m.asset_id} style={{ animationDelay: `${i * 80}ms` }}>
                  <AssetCard
                    match={m}
                    onBook={handleBook}
                    onViewCalendar={setCalendarAsset}
                    searchWindow={searchWindow}
                  />
                </div>
              ))}
            </div>

            {/* Didn't find the right space? Fall back to manual browse */}
            <div className="text-center mt-8 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-[14px] mb-3" style={{ color: t2 }}>Didn't find the right space?</p>
              <button onClick={() => setStage("browse")} className="btn-secondary">
                Browse all spaces manually
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ── Manual browse (fallback) ─────────────────────────────────────────── */
  if (stage === "browse") {
    return <BrowseView onBook={handleBook} onBack={() => setStage("search")} />;
  }

  /* ── DateTime picker ──────────────────────────────────────────────────── */
  if (stage === "datetime") {
    return (
      <DateTimePicker
        asset={holdAsset}
        searchWindow={searchWindow}
        loading={holding}
        error={error}
        onConfirm={handleHold}
        onBack={() => setStage("results")}
      />
    );
  }

  /* ── Hold state ────────────────────────────────────────────────────────── */
  if (stage === "hold") {
    return (
      <HoldScreen
        booking={holdBooking}
        asset={holdAsset}
        error={error}
        onConfirm={handleProceedToPayment}
        onCancel={reset}
      />
    );
  }

  /* ── Payment state ─────────────────────────────────────────────────────── */
  if (stage === "payment" && clientSecret) {
    return (
      <PaymentForm
        clientSecret={clientSecret}
        amountDisplay={paymentAmount}
        onSuccess={handleConfirm}
        onBack={() => setStage("hold")}
      />
    );
  }

  /* ── Confirmed ─────────────────────────────────────────────────────────── */
  if (stage === "confirmed") {
    return (
      <BookingConfirmation
        booking={confirmed}
        asset={holdAsset}
        onBack={reset}
        encouragement={encouragement}
        remindersScheduled={remindersCount}
        paymentAmount={paymentAmount}
        user={user}
        onViewMyBookings={onViewMyBookings}
      />
    );
  }

  /* ── Search home ───────────────────────────────────────────────────────── */
  return (
    <div>
      {error && (
        <div className="max-w-3xl mx-auto px-6 mt-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}
      <SearchBox onSearch={handleSearch} loading={holding} onBrowse={() => setStage("browse")} />
    </div>
  );
}

/* ── DateTime picker ─────────────────────────────────────────────────────── */
function DateTimePicker({ asset, searchWindow, loading, error, onConfirm, onBack }) {
  const toLocal = (iso) => {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  };

  const sw = searchWindow || { start: new Date(Date.now() + 172800000).toISOString(), end: new Date(Date.now() + 179200000).toISOString() };
  const startLocal = toLocal(sw.start);
  const endLocal   = toLocal(sw.end);

  const [date,           setDate]           = useState(startLocal.date);
  const [start,          setStart]          = useState(startLocal.time);
  const [end,            setEnd]            = useState(endLocal.time);
  const [err,            setErr]            = useState(null);
  const [isRecurring,    setIsRecurring]    = useState(false);
  const [recurrenceWeeks, setRecurrenceWeeks] = useState(4);
  const [dayBookings,    setDayBookings]    = useState([]);

  const today = new Date().toISOString().slice(0, 10);
  const rate  = Number(asset?.hourly_rate || 0);

  // Live availability for the chosen day, so conflicts surface before submitting
  useEffect(() => {
    if (!date || !asset?.id) return;
    let stale = false;
    const next = new Date(`${date}T00:00:00`);
    next.setDate(next.getDate() + 1);
    const pad = (n) => String(n).padStart(2, "0");
    const nextStr = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
    api.getAssetAvailability(asset.id, date, nextStr)
      .then((b) => { if (!stale) setDayBookings(b || []); })
      .catch(() => { if (!stale) setDayBookings([]); });
    return () => { stale = true; };
  }, [date, asset?.id]);

  const durationHours = (() => {
    const s = new Date(`${date}T${start}`);
    const e = new Date(`${date}T${end}`);
    const diff = (e - s) / 3600000;
    return diff > 0 ? diff : 0;
  })();

  const chosenStart = durationHours > 0 ? new Date(`${date}T${start}:00`) : null;
  const chosenEnd   = durationHours > 0 ? new Date(`${date}T${end}:00`)   : null;
  const hasConflict = chosenStart && dayBookings.some((b) => {
    const bs = new Date(b.start_time);
    const be = new Date(b.end_time);
    return bs < chosenEnd && be > chosenStart;
  });

  const sessions  = isRecurring ? recurrenceWeeks : 1;
  const totalCost = (rate * durationHours * sessions).toFixed(2);
  const isFree    = rate === 0;
  const fmtT = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const handleConfirm = async () => {
    setErr(null);
    if (!date) { setErr("Please select a date."); return; }
    if (start >= end) { setErr("End time must be after start time."); return; }
    if (durationHours < 0.5) { setErr("Minimum booking is 30 minutes."); return; }
    if (durationHours > 12)  { setErr("Maximum booking is 12 hours."); return; }

    // Re-fetch availability right before submitting to catch slots taken since page load
    try {
      const next = new Date(`${date}T00:00:00`);
      next.setDate(next.getDate() + 1);
      const pad = (n) => String(n).padStart(2, "0");
      const nextStr = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
      const fresh = await api.getAssetAvailability(asset.id, date, nextStr);
      const s = new Date(`${date}T${start}:00`);
      const e = new Date(`${date}T${end}:00`);
      const conflict = fresh.some((b) => new Date(b.start_time) < e && new Date(b.end_time) > s);
      if (conflict) {
        setDayBookings(fresh);
        setErr("This slot was just taken — please choose another time.");
        return;
      }
    } catch {
      // If re-fetch fails, let the server be the final arbiter
    }

    const startIso = new Date(`${date}T${start}:00`).toISOString();
    const endIso   = new Date(`${date}T${end}:00`).toISOString();
    onConfirm(startIso, endIso, isRecurring, recurrenceWeeks);
  };

  return (
    <div className="max-w-md mx-auto px-6 py-10 fade-in-up">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] hover:text-teal-600 mb-6 transition font-medium" style={{ color: "var(--text-2)" }}>
        <ArrowLeft size={14} /> Back to results
      </button>

      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: "var(--bg-card)", border: `1px solid ${"var(--border)"}` }}>
        {/* Asset header */}
        <div className="p-5" style={{ borderBottom: `1px solid ${"var(--surface-2)"}` }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-3)" }}>
            {(asset?.category || "").replace(/_/g, " ")}
          </p>
          <h2 className="text-[18px] font-black" style={{ color: "var(--text-1)" }}>{asset?.name}</h2>
          {asset?.ward && <p className="text-[13px] mt-0.5" style={{ color: "var(--text-2)" }}>{asset.ward}, Hillingdon</p>}
        </div>

        <div className="p-5 space-y-4">
          {/* Date */}
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-2)" }}>
              <Calendar size={12} /> Date
            </label>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition"
              style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text-1)" }}
            />
          </div>

          {/* Time range */}
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-2)" }}>
              <Clock size={12} /> Time
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] mb-1" style={{ color: "var(--text-3)" }}>From</p>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition"
                  style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text-1)" }} />
              </div>
              <div>
                <p className="text-[11px] mb-1" style={{ color: "var(--text-3)" }}>To</p>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition"
                  style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text-1)" }} />
              </div>
            </div>
          </div>

          {/* Already-booked times for the chosen day */}
          {dayBookings.length > 0 && (
            <div className="rounded-xl px-3.5 py-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-3)" }}>
                Already booked on this day
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dayBookings.map((b, i) => (
                  <span key={i} className="px-2 py-1 rounded-md text-[11px] font-semibold"
                    style={{ background: "var(--danger-bg)", color: "var(--danger-fg)" }}>
                    {fmtT(b.start_time)} – {fmtT(b.end_time)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Conflict warning */}
          {hasConflict && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[13px] text-amber-800" role="alert">
              Your chosen time overlaps an existing booking. Adjust the times above to a free window.
            </div>
          )}

          {/* Recurring booking */}
          <div>
            <div className="flex items-center justify-between">
              <label id="recurring-label" className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>
                <RefreshCw size={12} /> Repeat booking
              </label>
              <button
                type="button"
                onClick={() => setIsRecurring((v) => !v)}
                className="relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none"
                style={{ background: isRecurring ? "var(--brand)" : "var(--border-strong)" }}
                role="switch"
                aria-checked={isRecurring}
                aria-labelledby="recurring-label"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    isRecurring ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {isRecurring && (
              <div className="mt-3 rounded-xl p-3" style={{ background: "var(--brand-tint)", border: `1px solid ${"var(--brand-border)"}` }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: "var(--brand)" }}>
                  Repeat every week for:
                </p>
                <div className="flex gap-2 flex-wrap">
                  {[2, 4, 6, 8, 12].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setRecurrenceWeeks(w)}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-bold border transition"
                      style={recurrenceWeeks === w
                        ? { background: "var(--brand)", borderColor: "var(--brand)", color: "#fff" }
                        : { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-2)" }
                      }
                    >
                      {w} weeks
                    </button>
                  ))}
                </div>
                <p className="text-[11px] mt-2" style={{ color: "var(--text-3)" }}>
                  Up to {recurrenceWeeks} weekly bookings at the same time. Weeks already booked are skipped
                  and you only pay for the sessions you get.
                </p>
              </div>
            )}
          </div>

          {/* Price summary */}
          {durationHours > 0 && (
            <div className="rounded-xl p-4 flex items-center justify-between"
              style={{ background: "var(--brand-tint)", border: `1px solid ${"var(--brand-border)"}` }}>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>Duration</p>
                <p className="text-[15px] font-bold" style={{ color: "var(--text-1)" }}>{durationHours % 1 === 0 ? durationHours : durationHours.toFixed(1)} hrs</p>
              </div>
              <div className="flex items-center gap-1.5">
                <PoundSterling size={18} className="text-teal-500" />
                <div className="text-right">
                  <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-2)" }}>
                    {sessions > 1 ? `Total · ${sessions} sessions` : "Total"}
                  </p>
                  <p className="text-[20px] font-black" style={{ color: "var(--brand)" }}>{isFree ? "Free" : `£${totalCost}`}</p>
                </div>
              </div>
            </div>
          )}

          {/* Errors */}
          {(err || error) && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700">{err || error}</div>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading || durationHours <= 0 || hasConflict}
            className="btn-primary w-full justify-center"
          >
            {loading ? "Reserving…" : "Hold this space"}
          </button>
          <p className="text-[11px] text-center" style={{ color: "var(--text-3)" }}>
            You'll have 5 minutes to complete your booking after holding.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Hold screen ──────────────────────────────────────────────────────────── */
function HoldScreen({ booking, asset, error, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const [proceeding, setProceeding] = useState(false);
  const heldUntil = new Date(booking.held_until).getTime();
  const totalSeconds = Math.max(60, Math.round((heldUntil - Date.now()) / 1000 + 0));
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const durationRef = useState(totalSeconds)[0];

  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.round((heldUntil - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [heldUntil]);

  // Announce only at key thresholds — never every second (that would make
  // a screen reader read the countdown continuously and trap the user).
  useEffect(() => {
    if ([120, 60, 30, 10].includes(secondsLeft)) {
      setAnnounce(`${secondsLeft} seconds remaining to complete your booking.`);
    }
  }, [secondsLeft]);

  const progress = Math.min(100, (secondsLeft / durationRef) * 100);
  const isUrgent = secondsLeft <= 30;
  const expired  = secondsLeft <= 0;

  const t1 = "var(--text-1)";
  const t2 = "var(--text-2)";
  const detailBg = "var(--surface-2)";

  // Price summary — covers every secured weekly occurrence
  const occurrences = booking.recurrence_pattern?.occurrences?.length || 1;
  const skipped     = booking.recurrence_pattern?.skipped?.length || 0;
  const hours       = (new Date(booking.end_time) - new Date(booking.start_time)) / 36e5;
  const rate        = Number(asset?.hourly_rate || 0);
  const total       = rate * hours * occurrences;

  const handleProceed = async () => {
    setProceeding(true);
    try { await onConfirm(); } finally { setProceeding(false); }
  };

  if (expired) {
    return (
      <div className="max-w-md mx-auto px-6 py-14 fade-in-up">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "var(--bg-card)", border: "2px solid var(--border)" }}
          role="alert"
        >
          <div
            className="w-20 h-20 rounded-full border-4 flex items-center justify-center mx-auto mb-5"
            style={{ borderColor: "var(--danger)", background: "var(--danger-bg)" }}
          >
            <Clock size={30} style={{ color: "var(--danger)" }} />
          </div>
          <h2 className="text-[20px] font-bold mb-2" style={{ color: t1 }}>Your hold has expired</h2>
          <p className="text-[14px] mb-7 leading-relaxed" style={{ color: t2 }}>
            The slot at <strong style={{ color: t1 }}>{asset.name}</strong> has been released so others can book it.
            Don't worry — if it's still free, you can hold it again in seconds.
          </p>
          <button onClick={onCancel} className="btn-primary w-full justify-center">
            Search again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-6 py-14 fade-in-up">
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: "var(--bg-card)",
          border: `2px solid ${isUrgent ? "var(--danger)" : "var(--warning)"}`,
        }}
      >
        {/* Polite announcements only at thresholds — keeps screen readers usable */}
        <span className="sr-only" aria-live="polite" role="status">{announce}</span>

        {/* Countdown ring — visual only; not a live region */}
        <div
          className="w-20 h-20 rounded-full border-4 flex items-center justify-center mx-auto mb-5 transition-colors"
          style={{
            borderColor: isUrgent ? "var(--danger)" : "var(--warning)",
            background: isUrgent ? "var(--danger-bg)" : "var(--warning-bg)",
          }}
          aria-hidden="true"
        >
          <span className="text-2xl font-black" style={{ color: isUrgent ? "var(--danger)" : "var(--warning)" }}>
            {secondsLeft}
          </span>
        </div>

        <h2 className="text-[20px] font-bold mb-1" style={{ color: t1 }}>
          {t("hold_title")} {asset.name}
        </h2>

        {/* Booking details */}
        {booking.start_time && (
          <div className="text-left rounded-xl px-4 py-3 mb-4 space-y-1" style={{ background: detailBg }}>
            <p className="text-[12px]" style={{ color: t2 }}>
              <span className="font-semibold" style={{ color: t1 }}>Date: </span>
              {new Date(booking.start_time).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="text-[12px]" style={{ color: t2 }}>
              <span className="font-semibold" style={{ color: t1 }}>Time: </span>
              {new Date(booking.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              {" – "}
              {new Date(booking.end_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
            {occurrences > 1 && (
              <p className="text-[12px]" style={{ color: t2 }}>
                <span className="font-semibold" style={{ color: t1 }}>Repeats: </span>
                weekly · {occurrences} sessions secured
              </p>
            )}
            <p className="text-[12px]" style={{ color: t2 }}>
              <span className="font-semibold" style={{ color: t1 }}>Total: </span>
              {total > 0 ? `£${total.toFixed(2)}${occurrences > 1 ? ` (${occurrences} sessions)` : ""}` : "Free"}
            </p>
          </div>
        )}

        {skipped > 0 && (
          <div className="text-left rounded-xl px-4 py-3 mb-4 text-[12px] bg-amber-50 border border-amber-200 text-amber-800">
            {skipped} of your weekly dates {skipped === 1 ? "is" : "are"} already booked and will be skipped.
            You'll only be charged for the {occurrences} secured session{occurrences !== 1 ? "s" : ""}.
          </div>
        )}

        <p className="text-[14px] mb-6 leading-relaxed" style={{ color: t2 }}>
          {t("hold_sub")}{" "}
          <strong style={{ color: t1 }}>{secondsLeft} {t("hold_sub2")}</strong>
        </p>

        {/* Progress bar */}
        <div className="h-2 rounded-full overflow-hidden mb-5" style={{ background: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: isUrgent ? "var(--danger)" : "var(--warning)" }}
          />
        </div>

        {error && (
          <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700 text-left" role="alert">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} disabled={proceeding} className="btn-secondary">
            {t("hold_release")}
          </button>
          <button onClick={handleProceed} disabled={proceeding} className="btn-primary">
            {proceeding ? "One moment…" : t("hold_proceed")}
          </button>
        </div>
      </div>
    </div>
  );
}
