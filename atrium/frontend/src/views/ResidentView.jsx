import { useEffect, useState } from "react";
import { Sparkles, Network, ArrowLeft } from "lucide-react";
import SearchBox from "../components/SearchBox";
import AssetCard from "../components/AssetCard";
import BookingConfirmation from "./BookingConfirmation";
import PaymentForm from "../components/PaymentForm";
import { api } from "../api/client";
import { useLanguage } from "../context/LanguageContext";

export default function ResidentView({ user, onViewMyBookings }) {
  const { t } = useLanguage();
  const [stage, setStage] = useState("search"); // search | loading | results | hold | payment | confirmed
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

  const handleBook = async (asset) => {
    setHolding(true);
    setHoldAsset(asset);
    try {
      const booking = await api.hold({
        asset_id: asset.id,
        user_id: user.id,
        start_time: searchWindow.start,
        end_time: searchWindow.end,
        purpose: intent?.purpose_summary || "Booking via Atrium",
        attendee_count: intent?.capacity || null,
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
      const res = await api.confirm(holdBooking.id, user.id, true);
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
            style={{ background: "#EBF4FF", borderColor: "#BFDBFE" }}
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
          <div className="space-y-4">
            {matches.map((m, i) => (
              <div key={m.asset_id} style={{ animationDelay: `${i * 80}ms` }}>
                <AssetCard match={m} onBook={handleBook} />
              </div>
            ))}
          </div>
        )}
      </div>
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
