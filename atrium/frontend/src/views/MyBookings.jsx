import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar, MapPin, Clock, X, ArrowLeft, CheckCircle2,
  RefreshCw, Edit2, AlertTriangle, Users, ChevronRight,
} from "lucide-react";
import { api } from "../api/client";

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
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ animation: "scaleIn 0.2s ease" }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ─── Cancel modal ─────────────────────────────────────────────────── */
function CancelModal({ booking, onClose, onConfirm, loading }) {
  return (
    <Modal onClose={onClose}>
      <div className="px-7 pt-7 pb-6">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
          <AlertTriangle size={22} className="text-red-500" />
        </div>
        <h2 className="text-[20px] font-black text-gray-900 mb-1">Cancel booking?</h2>
        <p className="text-[14px] font-semibold text-gray-800 mb-0.5">{booking.asset?.name}</p>
        <p className="text-[13px] text-gray-500 mb-5">
          {fmtDate(booking.start_time)}<br />
          {fmtTime(booking.start_time)} – {fmtTime(booking.end_time)}
        </p>
        <div className="bg-emerald-50 rounded-2xl px-4 py-3.5 mb-6 flex items-start gap-2.5">
          <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-[13px] text-emerald-800 leading-relaxed">
            Any payment will be <strong>fully refunded</strong> to your card within 5–10 business days.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[14px] font-semibold rounded-2xl transition">
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

/* ─── Reschedule modal ─────────────────────────────────────────────── */
function RescheduleModal({ booking, user, onClose, onSuccess }) {
  const s = new Date(booking.start_time);
  const e = new Date(booking.end_time);
  const pad = (d) => d.toISOString().slice(0, 10);
  const hm  = (d) => d.toTimeString().slice(0, 5);

  const [date, setDate]     = useState(pad(s));
  const [start, setStart]   = useState(hm(s));
  const [end, setEnd]       = useState(hm(e));
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);
  const today = new Date().toISOString().slice(0, 10);

  const save = async () => {
    setErr(null);
    if (!date) { setErr("Please select a date."); return; }
    if (start >= end) { setErr("End time must be after start time."); return; }
    setSaving(true);
    try {
      const ns = new Date(`${date}T${start}:00`).toISOString();
      const ne = new Date(`${date}T${end}:00`).toISOString();
      const updated = await api.rescheduleBooking(booking.id, ns, ne);
      onSuccess({ ...booking, ...updated });
    } catch (ex) {
      setErr(ex.message.includes("slot_unavailable")
        ? "That time slot is already booked. Try a different time."
        : "Unable to reschedule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <div className="px-7 pt-7 pb-6">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
          <Edit2 size={20} className="text-hillingdon-navy" />
        </div>
        <h2 className="text-[20px] font-black text-gray-900 mb-1">Edit booking time</h2>
        <p className="text-[13px] text-gray-500 mb-6">{booking.asset?.name}</p>

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-wide mb-2">Date</label>
            <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-hillingdon-navy/30 focus:border-hillingdon-navy transition" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-wide mb-2">From</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-hillingdon-navy/30 focus:border-hillingdon-navy transition" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-gray-500 uppercase tracking-wide mb-2">To</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-hillingdon-navy/30 focus:border-hillingdon-navy transition" />
            </div>
          </div>
        </div>

        {err && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700">{err}</div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={saving} className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[14px] font-semibold rounded-2xl transition">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-3 text-white text-[14px] font-semibold rounded-2xl transition flex items-center justify-center gap-2 btn-primary"
            style={{ padding: "12px 16px" }}>
            {saving && <RefreshCw size={14} className="animate-spin" />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Booking card ─────────────────────────────────────────────────── */
function BookingCard({ booking, onCancel, onReschedule }) {
  const isPast = ["cancelled", "completed"].includes(booking.state);
  const st = STATUS[booking.state] || STATUS.completed;
  const duration = Math.round((new Date(booking.end_time) - new Date(booking.start_time)) / 36e5 * 10) / 10;

  return (
    <div className={`bg-white rounded-2xl overflow-hidden transition-all ${isPast ? "opacity-50 border border-gray-100" : "border border-gray-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5"}`}>
      {/* Status stripe */}
      <div className={`h-1.5 ${st.bg}`} />

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[16px] font-bold text-gray-900 leading-tight">{booking.asset?.name || "Unknown venue"}</p>
            {booking.asset?.ward && (
              <p className="text-[12px] text-gray-400 mt-0.5 flex items-center gap-1">
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
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Date</p>
            <p className="text-[13px] font-semibold text-gray-800">{fmtShort(booking.start_time)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Time</p>
            <p className="text-[13px] font-semibold text-gray-800">{fmtTime(booking.start_time)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Duration</p>
            <p className="text-[13px] font-semibold text-gray-800">{duration}h</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-[11px] font-mono text-gray-300">{booking.reference}</span>
          {!isPast && (
            <div className="flex items-center gap-1">
              {onReschedule && (
                <button onClick={onReschedule}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-hillingdon-navy hover:bg-blue-50 px-3 py-1.5 rounded-xl transition">
                  <Edit2 size={12} /> Edit time
                </button>
              )}
              {onCancel && (
                <button onClick={onCancel}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-xl transition">
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
  const [bookings, setBookings]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [toast, setToast]               = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [reschedTarget, setReschedTarget] = useState(null);
  const [cancelling, setCancelling]     = useState(false);

  useEffect(() => {
    api.listUserBookings().then(setBookings).finally(() => setLoading(false));
  }, [user.id]);

  const showToast = (type, data) => {
    setToast({ type, data });
    setTimeout(() => setToast(null), 7000);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await api.cancelBooking(cancelTarget.id);
      setBookings((prev) => prev.map((b) => b.id === cancelTarget.id ? { ...b, state: "cancelled" } : b));
      showToast("cancel", res.refund || {});
    } catch (ex) {
      showToast("error", { message: ex.message });
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const handleRescheduled = (updated) => {
    setBookings((prev) => prev.map((b) => b.id === updated.id ? { ...b, ...updated } : b));
    showToast("reschedule", updated);
    setReschedTarget(null);
  };

  const upcoming = bookings.filter((b) => ["confirmed", "held", "swap_pending"].includes(b.state));
  const past     = bookings.filter((b) => ["cancelled", "completed"].includes(b.state));

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
          user={user}
          onClose={() => setReschedTarget(null)}
          onSuccess={handleRescheduled}
        />
      )}

      {/* Page content */}
      <div className="max-w-2xl mx-auto px-5 py-8">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-hillingdon-navy mb-7 transition font-medium">
          <ArrowLeft size={14} /> Back to search
        </button>

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-[28px] font-black text-gray-900 tracking-tight">My Bookings</h1>
          <p className="text-[14px] text-gray-400 mt-1">
            {loading ? "Loading your reservations…" : `${upcoming.length} upcoming · ${past.length} past`}
          </p>
        </div>

        {/* Skeletons */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
                <div className="skeleton h-5 w-48 rounded" />
                <div className="skeleton h-3 w-32 rounded" />
                <div className="flex gap-3">
                  <div className="skeleton h-16 flex-1 rounded-xl" />
                  <div className="skeleton h-16 flex-1 rounded-xl" />
                  <div className="skeleton h-16 flex-1 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && bookings.length === 0 && (
          <div className="text-center py-24 bg-white border border-gray-100 rounded-3xl">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-[18px] font-bold text-gray-800 mb-2">No bookings yet</p>
            <p className="text-[14px] text-gray-400 mb-6">Your confirmed reservations will appear here.</p>
            <button onClick={onBack} className="btn-primary">Book a space now</button>
          </div>
        )}

        {/* Upcoming */}
        {!loading && upcoming.length > 0 && (
          <section className="mb-8">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400 mb-4">
              Upcoming · {upcoming.length}
            </p>
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

        {/* Past */}
        {!loading && past.length > 0 && (
          <section>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400 mb-4">
              Past · {past.length}
            </p>
            <div className="space-y-3">
              {past.map((b) => <BookingCard key={b.id} booking={b} />)}
            </div>
          </section>
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
