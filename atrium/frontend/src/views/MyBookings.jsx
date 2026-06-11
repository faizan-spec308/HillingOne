import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../context/ThemeContext";
import {
  Calendar, MapPin, Clock, X, ArrowLeft, CheckCircle2,
  RefreshCw, Edit2, AlertTriangle, Users, ChevronRight,
  TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { api } from "../api/client";

const stripePromise = loadStripe(
  "pk_test_51Tdu5YQwQUDdwUxjCQ5M2ucTRi7kp9yaCkfmUvkR9rwJNKbcpOEBhZVEYD5lcOcw7Gllzgj4ky0pPS1UKsHZjAPt00KXyYf3YG"
);

/* ─── helpers ──────────────────────────────────────────────────────── */
const fmtDate  = (iso) => new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtShort = (iso) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const fmtTime  = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const STATUS = {
  confirmed:    { label: "Confirmed",    bg: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  held:         { label: "Held",         bg: "bg-amber-400",   pill: "bg-amber-50 text-amber-700 ring-amber-200" },
  cancelled:    { label: "Cancelled",    bg: "bg-red-400",     pill: "bg-red-50 text-red-600 ring-red-100" },
  completed:    { label: "Completed",    bg: "bg-gray-300",    pill: "bg-gray-50 text-gray-500 ring-gray-200" },
  swap_pending: { label: "Pending swap", bg: "bg-blue-400",    pill: "bg-blue-50 text-blue-700 ring-blue-200" },
};

/* ─── Toast — always fixed top via portal ──────────────────────────── */
function Toast({ toast, onClose }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  return createPortal(
    <div
      className={`fixed top-4 left-1/2 z-[9999] w-full max-w-md -translate-x-1/2 px-4`}
      style={{ animation: "slideDown 0.3s ease" }}
    >
      <div className={`rounded-2xl shadow-xl border px-5 py-4 flex items-start gap-3 ${isError ? "bg-red-50 border-red-200" : "bg-white border-emerald-200"}`}>
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isError ? "bg-red-100" : "bg-emerald-100"}`}>
          {isError
            ? <AlertTriangle size={18} className="text-red-500" />
            : <CheckCircle2 size={18} className="text-emerald-600" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-gray-900 mb-0.5">
            {isError ? "Something went wrong" : toast.type === "cancel" ? "Booking cancelled" : "Booking rescheduled"}
          </p>
          <p className="text-[13px] text-gray-600 leading-relaxed">
            {isError && toast.data.message}
            {toast.type === "cancel" && (
              toast.data.refunded
                ? `Your refund of ${toast.data.amount} will appear in your account within 5–10 business days.`
                : "Your booking has been cancelled. No payment was taken."
            )}
            {toast.type === "reschedule" && `Rescheduled to ${fmtShort(toast.data.start_time)}, ${fmtTime(toast.data.start_time)} – ${fmtTime(toast.data.end_time)}`}
            {toast.type === "reschedule_refund" && `Rescheduled. A refund of ${toast.data.refund_amount} will appear within 5–10 business days.`}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 flex-shrink-0 mt-0.5">
          <X size={16} />
        </button>
      </div>
    </div>,
    document.body
  );
}

/* ─── Modal shell — portal, always centred, backdrop-blur ──────────── */
function Modal({ onClose, children }) {
  const { isDark } = useTheme();
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-5"
      style={{ backdropFilter: "blur(4px)", background: "rgba(15,23,42,0.5)", animation: "fadeIn 0.15s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-3xl shadow-2xl w-full max-w-sm overflow-y-auto"
        style={{ background: isDark ? "#161B22" : "#ffffff", border: isDark ? "1px solid #30363D" : "none", animation: "scaleIn 0.2s ease", maxHeight: "90vh" }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ─── Cancel modal ─────────────────────────────────────────────────── */
function CancelModal({ booking, onClose, onConfirm, loading }) {
  const { isDark } = useTheme();
  const lateCancel = new Date(booking.start_time) - Date.now() < 24 * 60 * 60 * 1000;
  const t1 = isDark ? "#E6EDF3" : "#111827";
  const t2 = isDark ? "#8B949E" : "#6B7280";

  return (
    <Modal onClose={onClose}>
      <div className="px-7 pt-7 pb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${lateCancel ? "bg-amber-50" : "bg-red-50"}`}>
          <AlertTriangle size={22} className={lateCancel ? "text-amber-500" : "text-red-500"} />
        </div>
        <h2 className="text-[20px] font-black mb-1" style={{ color: t1 }}>Cancel booking?</h2>
        <p className="text-[14px] font-semibold mb-0.5" style={{ color: t1 }}>{booking.asset?.name}</p>
        <p className="text-[13px] mb-5" style={{ color: t2 }}>
          {fmtDate(booking.start_time)}<br />
          {fmtTime(booking.start_time)} – {fmtTime(booking.end_time)}
        </p>
        {lateCancel ? (
          <div className="bg-amber-50 rounded-2xl px-4 py-3.5 mb-6 flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-800 leading-relaxed">
              Your booking starts within 24 hours. You will only receive a <strong>50% refund</strong> on any payment made.
            </p>
          </div>
        ) : (
          <div className="bg-emerald-50 rounded-2xl px-4 py-3.5 mb-6 flex items-start gap-2.5">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-emerald-800 leading-relaxed">
              Any payment will be <strong>fully refunded</strong> to your card within 5–10 business days.
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 px-4 py-3 text-[14px] font-semibold rounded-2xl transition"
            style={{ background: isDark ? "#21262D" : "#F3F4F6", color: isDark ? "#8B949E" : "#374151" }}>
            Keep it
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white text-[14px] font-semibold rounded-2xl transition flex items-center justify-center gap-2">
            {loading ? <RefreshCw size={15} className="animate-spin" /> : null}
            {loading ? "Cancelling…" : "Yes, cancel"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Stripe inline checkout (for reschedule upcharge) ─────────────── */
function RescheduleCheckout({ clientSecret, amountDisplay, onPaid, onBack }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [busy, setBusy]  = useState(false);
  const [err,  setErr]   = useState(null);

  const pay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setErr(null);
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (error) { setErr(error.message); setBusy(false); }
    else if (paymentIntent?.status === "succeeded") onPaid(paymentIntent.id);
    else { setErr("Payment did not complete. Please try again."); setBusy(false); }
  };

  return (
    <form onSubmit={pay} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {err && <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700">{err}</div>}
      <div className="flex gap-3">
        <button type="button" onClick={onBack} disabled={busy} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[14px] font-semibold rounded-2xl transition">
          Back
        </button>
        <button type="submit" disabled={busy || !stripe} className="btn-primary flex-1 justify-center text-[14px]">
          {busy ? <><RefreshCw size={13} className="animate-spin" /> Processing…</> : <>Pay {amountDisplay}</>}
        </button>
      </div>
      <p className="text-[11px] text-center text-gray-400">Test card: 4242 4242 4242 4242 · any future date · any CVC</p>
    </form>
  );
}

/* ─── Reschedule modal ─────────────────────────────────────────────── */
function RescheduleModal({ booking, onClose, onSuccess }) {
  const { isDark } = useTheme();
  const s   = new Date(booking.start_time);
  const e   = new Date(booking.end_time);
  const pad = (d) => d.toISOString().slice(0, 10);
  const hm  = (d) => d.toTimeString().slice(0, 5);

  const [date,  setDate]  = useState(pad(s));
  const [start, setStart] = useState(hm(s));
  const [end,   setEnd]   = useState(hm(e));
  const [saving, setSaving]         = useState(false);
  const [err,    setErr]            = useState(null);
  const [payment, setPayment]       = useState(null); // {clientSecret, paymentIntentId, amountDisplay, newStart, newEnd}
  const today    = new Date().toISOString().slice(0, 10);
  const payRef   = useRef(null);

  const t1 = isDark ? "#E6EDF3" : "#111827";
  const t2 = isDark ? "#8B949E" : "#6B7280";
  const inputStyle = {
    background: isDark ? "#0E1117" : "#ffffff",
    border: `1px solid ${isDark ? "#30363D" : "#E5E7EB"}`,
    color: isDark ? "#E6EDF3" : "#111827",
  };

  useLayoutEffect(() => {
    if (payment && payRef.current) {
      payRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [payment]);

  const rate = parseFloat(booking.asset?.hourly_rate ?? 0);
  const origHours = (e - s) / 3_600_000;

  const newStart = date && start ? new Date(`${date}T${start}:00`) : null;
  const newEnd   = date && end   ? new Date(`${date}T${end}:00`)   : null;
  const newHours = newStart && newEnd && newEnd > newStart ? (newEnd - newStart) / 3_600_000 : 0;
  const diffGbp  = rate > 0 && newHours > 0 ? (newHours - origHours) * rate : 0;

  const submit = async () => {
    setErr(null);
    if (!date)         { setErr("Please select a date."); return; }
    if (start >= end)  { setErr("End time must be after start time."); return; }
    if (newHours < 0.5){ setErr("Minimum booking is 30 minutes."); return; }
    if (newHours > 12) { setErr("Maximum booking is 12 hours."); return; }
    setSaving(true);
    try {
      const ns = newStart.toISOString();
      const ne = newEnd.toISOString();
      const res = await api.rescheduleBooking(booking.id, ns, ne);

      if (res.requires_payment) {
        setPayment({ clientSecret: res.client_secret, paymentIntentId: res.payment_intent_id,
                     amountDisplay: res.amount_display, newStart: ns, newEnd: ne });
      } else {
        onSuccess({ ...booking, ...res });
      }
    } catch (ex) {
      setErr(ex.message);
    } finally { setSaving(false); }
  };

  const handlePaid = async (paymentIntentId) => {
    setSaving(true); setErr(null);
    try {
      const res = await api.rescheduleConfirm(booking.id, paymentIntentId, payment.newStart, payment.newEnd);
      onSuccess({ ...booking, ...res });
    } catch (ex) {
      setErr(ex.message);
      setSaving(false);
    }
  };

  const stripeOptions = payment ? {
    clientSecret: payment.clientSecret,
    appearance: { theme: "stripe", variables: { colorPrimary: "#0D9488", borderRadius: "12px", fontFamily: "Inter, sans-serif" } },
  } : null;

  return (
    <Modal onClose={onClose}>
      <div className="px-7 pt-7 pb-6">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
          <Edit2 size={20} className="text-teal-600" />
        </div>
        <h2 className="text-[20px] font-black mb-0.5" style={{ color: t1 }}>
          {payment ? "Pay to confirm reschedule" : "Edit booking time"}
        </h2>
        <p className="text-[13px] mb-5" style={{ color: t2 }}>{booking.asset?.name}</p>

        {!payment ? (
          <>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: t2 }}>Date</label>
                <input type="date" min={today} value={date} onChange={ev => setDate(ev.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: t2 }}>From</label>
                  <input type="time" value={start} onChange={ev => setStart(ev.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                    style={inputStyle} />
                </div>
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wide mb-2" style={{ color: t2 }}>To</label>
                  <input type="time" value={end} onChange={ev => setEnd(ev.target.value)}
                    className="w-full rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                    style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Live price diff */}
            {rate > 0 && newHours > 0 && Math.abs(diffGbp) >= 0.01 && (
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl mb-4 text-[13px] font-semibold ${
                diffGbp > 0
                  ? "bg-amber-50 border border-amber-100 text-amber-800"
                  : "bg-emerald-50 border border-emerald-100 text-emerald-800"
              }`}>
                {diffGbp > 0
                  ? <TrendingUp size={15} className="text-amber-500 flex-shrink-0" />
                  : <TrendingDown size={15} className="text-emerald-500 flex-shrink-0" />
                }
                {diffGbp > 0
                  ? `Additional charge: £${diffGbp.toFixed(2)}`
                  : `You'll be refunded: £${Math.abs(diffGbp).toFixed(2)}`
                }
                <span className="ml-auto text-[11px] font-normal opacity-70">
                  {newHours.toFixed(1)}h @ £{rate.toFixed(2)}/h
                </span>
              </div>
            )}
            {rate > 0 && newHours > 0 && Math.abs(diffGbp) < 0.01 && newHours !== origHours && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-4 text-[13px] font-semibold bg-gray-50 border border-gray-100 text-gray-600">
                <Minus size={14} className="text-gray-400 flex-shrink-0" /> No price change
              </div>
            )}

            {err && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700">{err}</div>}

            <div className="flex gap-3">
              <button onClick={onClose} disabled={saving}
                className="flex-1 px-4 py-3 text-[14px] font-semibold rounded-2xl transition"
                style={{ background: isDark ? "#21262D" : "#F3F4F6", color: isDark ? "#8B949E" : "#374151" }}>
                Cancel
              </button>
              <button onClick={submit} disabled={saving} className="btn-primary flex-1 justify-center text-[14px]">
                {saving
                  ? <><RefreshCw size={13} className="animate-spin" /> Checking…</>
                  : diffGbp > 0 && rate > 0
                    ? `Pay £${diffGbp.toFixed(2)} & reschedule`
                    : "Save changes"
                }
              </button>
            </div>
          </>
        ) : (
          <div ref={payRef}>
            {err && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700">{err}</div>}
            <Elements stripe={stripePromise} options={stripeOptions}>
              <RescheduleCheckout
                clientSecret={payment.clientSecret}
                amountDisplay={payment.amountDisplay}
                onPaid={handlePaid}
                onBack={() => { setPayment(null); setErr(null); }}
              />
            </Elements>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ─── Booking card ─────────────────────────────────────────────────── */
function BookingCard({ booking, onCancel, onReschedule }) {
  const { isDark } = useTheme();
  const isPast = ["cancelled", "completed"].includes(booking.state);
  const st = STATUS[booking.state] || STATUS.completed;
  const duration = Math.round((new Date(booking.end_time) - new Date(booking.start_time)) / 36e5 * 10) / 10;

  const cardBg  = isDark ? "#161B22" : "#ffffff";
  const cardBdr = isPast
    ? (isDark ? "#21262D" : "#F3F4F6")
    : (isDark ? "#30363D" : "#E5E7EB");
  const cellBg  = isDark ? "#21262D" : "#F9FAFB";
  const t1 = isDark ? "#E6EDF3" : "#111827";
  const t2 = isDark ? "#8B949E" : "#9CA3AF";
  const t3 = isDark ? "#8B949E" : "#1F2937";

  return (
    <div
      className={`rounded-2xl overflow-hidden transition-all ${isPast ? "opacity-60" : "hover:shadow-lg hover:-translate-y-0.5"}`}
      style={{ background: cardBg, border: `1px solid ${cardBdr}` }}
    >
      {/* Status stripe */}
      <div className={`h-1.5 ${st.bg}`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[16px] font-bold leading-tight" style={{ color: t1 }}>{booking.asset?.name || "Unknown venue"}</p>
            {booking.asset?.ward && (
              <p className="text-[12px] mt-0.5 flex items-center gap-1" style={{ color: t2 }}>
                <MapPin size={10} /> {booking.asset.ward}, Hillingdon
              </p>
            )}
          </div>
          <span className={`text-[11px] font-bold px-3 py-1 rounded-full ring-1 flex-shrink-0 ${st.pill}`}>
            {st.label}
          </span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[["Date", fmtShort(booking.start_time)], ["Time", fmtTime(booking.start_time)], ["Duration", `${duration}h`]].map(([label, val]) => (
            <div key={label} className="rounded-xl p-3" style={{ background: cellBg }}>
              <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: t2 }}>{label}</p>
              <p className="text-[13px] font-semibold" style={{ color: t3 }}>{val}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${isDark ? "#21262D" : "#F3F4F6"}` }}>
          <span className="text-[11px] font-mono" style={{ color: isDark ? "#484F58" : "#D1D5DB" }}>{booking.reference}</span>
          {!isPast && (
            <div className="flex items-center gap-1">
              {onReschedule && (
                <button onClick={onReschedule}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-teal-600 hover:bg-teal-50/10 px-3 py-1.5 rounded-xl transition">
                  <Edit2 size={12} /> Edit time
                </button>
              )}
              {onCancel && (
                <button onClick={onCancel}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-500 hover:bg-red-50/10 px-3 py-1.5 rounded-xl transition">
                  <X size={12} /> Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main view ────────────────────────────────────────────────────── */
export default function MyBookings({ user, onBack }) {
  const { isDark } = useTheme();
  const [upcoming, setUpcoming]         = useState([]);
  const [past, setPast]                 = useState([]);
  const [hasMore, setHasMore]           = useState(false);
  const [page, setPage]                 = useState(1);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [toast, setToast]               = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reschedTarget, setReschedTarget] = useState(null);
  const [cancelling, setCancelling]     = useState(false);
  const [filter, setFilter]             = useState("all");

  const t1   = isDark ? "#E6EDF3" : "#111827";
  const t2   = isDark ? "#8B949E" : "#9CA3AF";
  const bdr  = isDark ? "#30363D" : "#E5E7EB";
  const surf = isDark ? "#161B22" : "#ffffff";
  const skel = isDark ? "#21262D" : "#F3F4F6";

  useEffect(() => {
    api.listUserBookings(1).then((res) => {
      setUpcoming(res.upcoming);
      setPast(res.past);
      setHasMore(res.has_more);
      setPage(1);
    }).finally(() => setLoading(false));
  }, [user.id]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await api.listUserBookings(nextPage);
      setPast((prev) => [...prev, ...res.past]);
      setHasMore(res.has_more);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const showToast = (type, data) => {
    setToast({ type, data });
    setTimeout(() => setToast(null), 7000);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await api.cancelBooking(cancelTarget.id);
      setUpcoming((prev) => prev.filter((b) => b.id !== cancelTarget.id));
      setPast((prev) => [{ ...cancelTarget, state: "cancelled" }, ...prev]);
      showToast("cancel", res.refund || {});
    } catch (ex) {
      showToast("error", { message: ex.message });
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const handleRescheduled = (updated) => {
    setUpcoming((prev) => prev.map((b) => b.id === updated.id ? { ...b, ...updated } : b));
    showToast(updated.refunded ? "reschedule_refund" : "reschedule", updated);
    setReschedTarget(null);
  };

  return (
    <>
      {/* Toast — portal to body, always top-center */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Modals — portals to body, always truly centered */}
      {cancelTarget && (
        <CancelModal
          booking={cancelTarget}
          loading={cancelling}
          onClose={() => !cancelling && setCancelTarget(null)}
          onConfirm={handleCancel}
        />
      )}
      {reschedTarget && (
        <RescheduleModal
          booking={reschedTarget}
          onClose={() => setReschedTarget(null)}
          onSuccess={handleRescheduled}
        />
      )}

      {/* Page content */}
      <div className="max-w-2xl mx-auto px-5 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] hover:text-teal-600 mb-7 transition font-medium" style={{ color: t2 }}>
          <ArrowLeft size={14} /> Back to search
        </button>

        {/* Hero */}
        <div className="mb-6">
          <h1 className="text-[28px] font-black tracking-tight" style={{ color: t1 }}>My Bookings</h1>
          <p className="text-[14px] mt-1" style={{ color: t2 }}>
            {loading ? "Loading your reservations…" : `${upcoming.length} upcoming · ${past.filter(b => b.state !== "cancelled").length} past · ${past.filter(b => b.state === "cancelled").length} cancelled`}
          </p>
        </div>

        {/* Stats strip */}
        {!loading && (upcoming.length + past.length) > 0 && (() => {
          const all = [...upcoming, ...past];
          const confirmed = all.filter(b => b.state !== "cancelled");
          const totalHours = confirmed.reduce((sum, b) => {
            const h = (new Date(b.end_time) - new Date(b.start_time)) / 3600000;
            return sum + (h > 0 ? h : 0);
          }, 0);
          const carbonKg = Math.round(confirmed.length * 2.4);
          const totalSpend = confirmed.reduce((sum, b) => sum + (b.total_amount_pence || 0), 0) / 100;

          const stats = [
            { label: "Total bookings", value: confirmed.length, unit: "" },
            { label: "Hours booked",   value: Math.round(totalHours * 10) / 10, unit: "h" },
            { label: "CO₂ saved",      value: carbonKg, unit: "kg" },
            ...(totalSpend > 0 ? [{ label: "Total spent", value: `£${totalSpend.toFixed(2)}`, unit: "" }] : []),
          ];

          return (
            <div className="rounded-2xl mb-6 overflow-hidden" style={{ background: surf, border: `1px solid ${bdr}` }}>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${stats.length}, 1fr)` }}>
                {stats.map(({ label, value, unit }, i) => (
                  <div
                    key={label}
                    className="px-4 py-4 text-center"
                    style={{ borderRight: i < stats.length - 1 ? `1px solid ${bdr}` : "none" }}
                  >
                    <div className="text-[20px] font-black leading-tight" style={{ color: "#0D9488" }}>
                      {value}{unit}
                    </div>
                    <div className="text-[11px] font-medium mt-0.5" style={{ color: t2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Filter tabs */}
        {!loading && (
          <div className="flex items-center gap-1 mb-6" style={{ borderBottom: `1px solid ${bdr}` }}>
            {[
              { id: "all",       label: "All",       count: upcoming.length + past.length },
              { id: "upcoming",  label: "Upcoming",  count: upcoming.length },
              { id: "past",      label: "Past",      count: past.filter(b => b.state !== "cancelled").length },
              { id: "cancelled", label: "Cancelled", count: past.filter(b => b.state === "cancelled").length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors"
                style={{
                  borderBottomColor: filter === tab.id ? "#0D9488" : "transparent",
                  color: filter === tab.id ? "#0D9488" : t2,
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className="text-[11px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      background: filter === tab.id ? (isDark ? "rgba(13,148,136,0.15)" : "#CCFBF1") : (isDark ? "#21262D" : "#F3F4F6"),
                      color: filter === tab.id ? "#0D9488" : t2,
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: surf, border: `1px solid ${bdr}` }}>
                <div className="h-5 w-48 rounded animate-pulse" style={{ background: skel }} />
                <div className="h-3 w-32 rounded animate-pulse" style={{ background: skel }} />
                <div className="flex gap-3">
                  <div className="h-16 flex-1 rounded-xl animate-pulse" style={{ background: skel }} />
                  <div className="h-16 flex-1 rounded-xl animate-pulse" style={{ background: skel }} />
                  <div className="h-16 flex-1 rounded-xl animate-pulse" style={{ background: skel }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && upcoming.length === 0 && past.length === 0 && (
          <div className="text-center py-24 rounded-3xl" style={{ background: surf, border: `1px solid ${bdr}` }}>
            <div className="text-5xl mb-4">📭</div>
            <p className="text-[18px] font-bold mb-2" style={{ color: t1 }}>No bookings yet</p>
            <p className="text-[14px] mb-6" style={{ color: t2 }}>Your confirmed reservations will appear here.</p>
            <button onClick={onBack} className="btn-primary">Book a space now</button>
          </div>
        )}

        {/* Upcoming section */}
        {!loading && (filter === "all" || filter === "upcoming") && upcoming.length > 0 && (
          <section className="mb-8">
            {filter === "all" && (
              <p className="text-[11px] font-black uppercase tracking-[0.12em] mb-4" style={{ color: t2 }}>
                Upcoming · {upcoming.length}
              </p>
            )}
            <div className="space-y-3">
              {upcoming.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  onCancel={() => setCancelTarget(b)}
                  onReschedule={() => setReschedTarget(b)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Past section (non-cancelled) */}
        {!loading && (filter === "all" || filter === "past") && (() => {
          const shown = past.filter(b => b.state !== "cancelled");
          if (shown.length === 0) return null;
          return (
            <section className="mb-8">
              {filter === "all" && (
                <p className="text-[11px] font-black uppercase tracking-[0.12em] mb-4" style={{ color: t2 }}>
                  Past · {shown.length}{hasMore ? "+" : ""}
                </p>
              )}
              <div className="space-y-3">
                {shown.map((b) => <BookingCard key={b.id} booking={b} />)}
              </div>
              {hasMore && (filter === "all" || filter === "past") && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="mt-4 w-full py-3 rounded-2xl text-[13px] font-semibold transition flex items-center justify-center gap-2"
                  style={{ border: `1px solid ${bdr}`, color: t2, background: "transparent" }}
                >
                  {loadingMore ? <RefreshCw size={14} className="animate-spin" /> : null}
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              )}
            </section>
          );
        })()}

        {/* Cancelled section */}
        {!loading && (filter === "all" || filter === "cancelled") && (() => {
          const shown = past.filter(b => b.state === "cancelled");
          if (shown.length === 0) {
            if (filter !== "cancelled") return null;
            return (
              <div className="text-center py-16 rounded-3xl" style={{ background: surf, border: `1px solid ${bdr}` }}>
                <p className="text-[16px] font-bold mb-1" style={{ color: t1 }}>No cancelled bookings</p>
                <p className="text-[13px]" style={{ color: t2 }}>Any cancelled reservations will appear here.</p>
              </div>
            );
          }
          return (
            <section>
              {filter === "all" && (
                <p className="text-[11px] font-black uppercase tracking-[0.12em] mb-4" style={{ color: t2 }}>
                  Cancelled · {shown.length}
                </p>
              )}
              <div className="space-y-3">
                {shown.map((b) => <BookingCard key={b.id} booking={b} />)}
              </div>
            </section>
          );
        })()}

        {/* Empty state for a specific filter */}
        {!loading && filter === "upcoming" && upcoming.length === 0 && (
          <div className="text-center py-16 rounded-3xl" style={{ background: surf, border: `1px solid ${bdr}` }}>
            <p className="text-[16px] font-bold mb-1" style={{ color: t1 }}>No upcoming bookings</p>
            <p className="text-[13px] mb-5" style={{ color: t2 }}>Book a space to get started.</p>
            <button onClick={onBack} className="btn-primary">Find a space</button>
          </div>
        )}
        {!loading && filter === "past" && past.filter(b => b.state !== "cancelled").length === 0 && past.length > 0 && (
          <div className="text-center py-16 rounded-3xl" style={{ background: surf, border: `1px solid ${bdr}` }}>
            <p className="text-[16px] font-bold mb-1" style={{ color: t1 }}>No past bookings</p>
            <p className="text-[13px]" style={{ color: t2 }}>Completed reservations will appear here.</p>
          </div>
        )}
      </div>

      {/* Keyframe styles injected once */}
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translate(-50%,-12px); } to { opacity:1; transform:translate(-50%,0); } }
        @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
        @keyframes scaleIn   { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
      `}</style>
    </>
  );
}
