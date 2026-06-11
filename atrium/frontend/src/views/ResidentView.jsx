import { useEffect, useState } from "react";
import { Sparkles, Network, ArrowLeft, Calendar, Clock, PoundSterling, RefreshCw } from "lucide-react";
import SearchBox from "../components/SearchBox";
import AssetCard from "../components/AssetCard";
import AssetCalendar from "../components/AssetCalendar";
import BookingConfirmation from "./BookingConfirmation";
import PaymentForm from "../components/PaymentForm";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

const STAGE_PATHS = {
  search:    "/",
  loading:   "/search",
  results:   "/results",
  datetime:  "/book",
  hold:      "/hold",
  payment:   "/pay",
  confirmed: "/confirmed",
};

export default function ResidentView({ user, onViewMyBookings }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
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
    try {
      const res = await api.createPaymentIntent(holdBooking.id);
      setClientSecret(res.client_secret);
      setPaymentAmount(res.amount_display);
      setStage("payment");
    } catch (err) {
      // If Stripe isn't configured, skip payment and confirm directly
      setError(null);
      await handleConfirm();
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
    return (
      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-hillingdon-navy text-white rounded-full text-sm font-semibold pulse-subtle mb-6">
            <Network size={15} />
            {t("results_loading_label")}
          </div>
          <p className="text-[15px] text-gray-500">
            {t("results_loading_sub")}
          </p>
        </div>

        {/* Skeleton cards */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4">
              <div className="skeleton w-[72px] h-[72px] rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-3 py-1">
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-5 w-48 rounded" />
                <div className="skeleton h-2 w-full rounded" />
                <div className="skeleton h-2 w-3/4 rounded" />
                <div className="flex gap-2 pt-1">
                  <div className="skeleton h-6 w-20 rounded-full" />
                  <div className="skeleton h-6 w-16 rounded-full" />
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
    return (
      <div className="max-w-3xl mx-auto px-6 py-8 fade-in-up">
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-hillingdon-navy mb-6 transition font-medium"
        >
          <ArrowLeft size={15} />
          {t("results_new_search")}
        </button>

        {/* Intent panel */}
        {intent?.extracted_summary && (
          <div
            className="rounded-2xl p-5 mb-6 border"
            style={isDark
              ? { background: "#0D1F2D", borderColor: "#1E4A6E" }
              : { background: "#EBF4FF", borderColor: "#BFDBFE" }}
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-hillingdon-navy flex items-center justify-center flex-shrink-0">
                <Sparkles size={15} className="text-white" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-hillingdon-navy mb-1">
                  {t("results_understood")}
                </div>
                <p className="text-[14px] text-gray-800 leading-relaxed">{intent.extracted_summary}</p>
                {intent.follow_up_question && (
                  <p className="mt-2 text-[14px] font-semibold text-gray-900">
                    ✦ {intent.follow_up_question}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Count */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-[13px] text-gray-500 font-medium">
            {matches.length} {matches.length === 1 ? t("results_match") : t("results_matches")}
          </p>
        </div>

        {matches.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-[16px] font-bold text-gray-900 mb-2">{t("results_none")}</h3>
            <p className="text-[14px] text-gray-500 mb-6">
              {t("results_none_sub")}
            </p>
            <button onClick={reset} className="btn-primary">
              {t("results_search_again")}
            </button>
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
          </>
        )}
      </div>
    );
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
      <SearchBox onSearch={handleSearch} loading={holding} />
    </div>
  );
}

/* ── DateTime picker ─────────────────────────────────────────────────────── */
function DateTimePicker({ asset, searchWindow, loading, error, onConfirm, onBack }) {
  const { isDark } = useTheme();
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

  const today = new Date().toISOString().slice(0, 10);
  const rate  = Number(asset?.hourly_rate || 0);

  const durationHours = (() => {
    const s = new Date(`${date}T${start}`);
    const e = new Date(`${date}T${end}`);
    const diff = (e - s) / 3600000;
    return diff > 0 ? diff : 0;
  })();

  const totalCost = (rate * durationHours).toFixed(2);
  const isFree    = rate === 0;

  const handleConfirm = () => {
    setErr(null);
    if (!date) { setErr("Please select a date."); return; }
    if (start >= end) { setErr("End time must be after start time."); return; }
    if (durationHours < 0.5) { setErr("Minimum booking is 30 minutes."); return; }
    if (durationHours > 12)  { setErr("Maximum booking is 12 hours."); return; }
    const startIso = new Date(`${date}T${start}:00`).toISOString();
    const endIso   = new Date(`${date}T${end}:00`).toISOString();
    onConfirm(startIso, endIso, isRecurring, recurrenceWeeks);
  };

  return (
    <div className="max-w-md mx-auto px-6 py-10 fade-in-up">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-hillingdon-navy mb-6 transition font-medium">
        <ArrowLeft size={14} /> Back to results
      </button>

      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ background: isDark ? "#161B22" : "#ffffff", border: `1px solid ${isDark ? "#30363D" : "#E5E7EB"}` }}>
        {/* Asset header */}
        <div className="p-5" style={{ borderBottom: `1px solid ${isDark ? "#21262D" : "#F3F4F6"}` }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: isDark ? "#8B949E" : "#9CA3AF" }}>
            {(asset?.category || "").replace(/_/g, " ")}
          </p>
          <h2 className="text-[18px] font-black" style={{ color: isDark ? "#E6EDF3" : "#111827" }}>{asset?.name}</h2>
          {asset?.ward && <p className="text-[13px] mt-0.5" style={{ color: isDark ? "#8B949E" : "#6B7280" }}>{asset.ward}, Hillingdon</p>}
        </div>

        <div className="p-5 space-y-4">
          {/* Date */}
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              <Calendar size={12} /> Date
            </label>
            <input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition"
              style={{ background: isDark ? "#0E1117" : "#ffffff", borderColor: isDark ? "#30363D" : "#E5E7EB", color: isDark ? "#E6EDF3" : "#111827" }}
            />
          </div>

          {/* Time range */}
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              <Clock size={12} /> Time
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-gray-400 mb-1">From</p>
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition"
                  style={{ background: isDark ? "#0E1117" : "#ffffff", borderColor: isDark ? "#30363D" : "#E5E7EB", color: isDark ? "#E6EDF3" : "#111827" }} />
              </div>
              <div>
                <p className="text-[11px] mb-1" style={{ color: isDark ? "#8B949E" : "#9CA3AF" }}>To</p>
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                  className="w-full border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition"
                  style={{ background: isDark ? "#0E1117" : "#ffffff", borderColor: isDark ? "#30363D" : "#E5E7EB", color: isDark ? "#E6EDF3" : "#111827" }} />
              </div>
            </div>
          </div>

          {/* Recurring booking */}
          <div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 uppercase tracking-wide">
                <RefreshCw size={12} /> Repeat booking
              </label>
              <button
                type="button"
                onClick={() => setIsRecurring((v) => !v)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  isRecurring ? "bg-teal-500" : "bg-gray-200"
                }`}
                role="switch"
                aria-checked={isRecurring}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    isRecurring ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {isRecurring && (
              <div className="mt-3 rounded-xl p-3" style={{ background: isDark ? "#0D2D1E" : "#F0FDF4", border: `1px solid ${isDark ? "#1A4731" : "#BBF7D0"}` }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: isDark ? "#4ADE80" : "#0D9488" }}>
                  Repeat every week for:
                </p>
                <div className="flex gap-2 flex-wrap">
                  {[2, 4, 6, 8, 12].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setRecurrenceWeeks(w)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-bold border transition ${
                        recurrenceWeeks === w
                          ? "bg-teal-600 border-teal-600 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:border-teal-400"
                      }`}
                    >
                      {w} weeks
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  {recurrenceWeeks} bookings will be created at the same time each week.
                </p>
              </div>
            )}
          </div>

          {/* Price summary */}
          {durationHours > 0 && (
            <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
              <div>
                <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Duration</p>
                <p className="text-[15px] font-bold text-gray-900">{durationHours % 1 === 0 ? durationHours : durationHours.toFixed(1)} hrs</p>
              </div>
              <div className="flex items-center gap-1.5">
                <PoundSterling size={18} className="text-teal-600" />
                <div className="text-right">
                  <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Total</p>
                  <p className="text-[20px] font-black text-teal-700">{isFree ? "Free" : `£${totalCost}`}</p>
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
            disabled={loading || durationHours <= 0}
            className="btn-primary w-full justify-center"
          >
            {loading ? "Reserving…" : "Hold this space"}
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            You'll have 5 minutes to complete your booking after holding.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Hold screen ──────────────────────────────────────────────────────────── */
function HoldScreen({ booking, asset, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const heldUntil = new Date(booking.held_until).getTime();
  const totalSeconds = Math.max(60, Math.round((heldUntil - Date.now()) / 1000 + 0));
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const durationRef = useState(totalSeconds)[0];

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.round((heldUntil - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [heldUntil]);

  const progress = Math.min(100, (secondsLeft / durationRef) * 100);
  const isUrgent = secondsLeft <= 30;

  return (
    <div className="max-w-md mx-auto px-6 py-14 fade-in-up">
      <div
        className="bg-white border-2 rounded-2xl p-8 text-center"
        style={{ borderColor: isUrgent ? "#EF4444" : "#F59E0B" }}
      >
        {/* Countdown ring */}
        <div
          className={`w-20 h-20 rounded-full border-4 flex items-center justify-center mx-auto mb-5 transition-colors ${
            isUrgent ? "border-red-400 bg-red-50" : "border-amber-400 bg-amber-50"
          }`}
        >
          <span className={`text-2xl font-black ${isUrgent ? "text-red-600" : "text-amber-700"}`}>
            {secondsLeft}
          </span>
        </div>

        <h2 className="text-[20px] font-bold text-gray-900 mb-1">
          {t("hold_title")} {asset.name}
        </h2>

        {/* Booking details */}
        {booking.start_time && (
          <div className="text-left bg-gray-50 rounded-xl px-4 py-3 mb-4 space-y-1">
            <p className="text-[12px] text-gray-500">
              <span className="font-semibold text-gray-700">Date: </span>
              {new Date(booking.start_time).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <p className="text-[12px] text-gray-500">
              <span className="font-semibold text-gray-700">Time: </span>
              {new Date(booking.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              {" – "}
              {new Date(booking.end_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
            {booking.total_amount_pence > 0 && (
              <p className="text-[12px] text-gray-500">
                <span className="font-semibold text-gray-700">Total: </span>
                £{(booking.total_amount_pence / 100).toFixed(2)}
              </p>
            )}
          </div>
        )}

        <p className="text-[14px] text-gray-500 mb-6 leading-relaxed">
          {t("hold_sub")}{" "}
          <strong>{secondsLeft} {t("hold_sub2")}</strong>
        </p>

        {/* Progress bar */}
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-7">
          <div
            className={`h-full rounded-full transition-all duration-500 ${isUrgent ? "bg-red-500" : "bg-amber-400"}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="btn-secondary">
            {t("hold_release")}
          </button>
          <button onClick={onConfirm} className="btn-primary">
            {t("hold_proceed")}
          </button>
        </div>
      </div>
    </div>
  );
}
