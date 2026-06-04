import { useEffect, useRef, useState } from "react";
import {
  Calendar, MapPin, Clock, X, ArrowLeft, CheckCircle2,
  RefreshCw, Edit2, AlertTriangle, ChevronRight,
} from "lucide-react";
import { api } from "../api/client";

/* ── helpers ─────────────────────────────────────────────────── */
const fmt = (iso, opts) => new Date(iso).toLocaleDateString("en-GB", opts);
const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const BADGE = {
  confirmed:    "bg-emerald-100 text-emerald-700 border-emerald-200",
  held:         "bg-amber-100 text-amber-700 border-amber-200",
  cancelled:    "bg-red-50 text-red-500 border-red-100",
  completed:    "bg-gray-100 text-gray-500 border-gray-200",
  swap_pending: "bg-blue-100 text-blue-700 border-blue-200",
};
const BADGE_LABEL = {
  confirmed: "Confirmed", held: "Held",
  cancelled: "Cancelled", completed: "Completed", swap_pending: "Swap pending",
};

/* ── main view ───────────────────────────────────────────────── */
export default function MyBookings({ user, onBack }) {
  const [bookings, setBookings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);   // { type: "cancel"|"reschedule", data }
  const [cancelTarget, setCancelTarget]     = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    api.listUserBookings(user.id).then(setBookings).finally(() => setLoading(false));
  }, [user.id]);

  const showToast = (type, data) => {
    setToast({ type, data });
    setTimeout(() => setToast(null), 8000);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await api.cancelBooking(cancelTarget.id, user.id);
      setBookings((prev) => prev.map((b) => b.id === cancelTarget.id ? { ...b, state: "cancelled" } : b));
      showToast("cancel", res.refund || {});
    } catch (err) {
      showToast("error", { message: err.message });
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const handleRescheduled = (updated) => {
    setBookings((prev) => prev.map((b) => b.id === updated.id ? { ...b, ...updated } : b));
    showToast("reschedule", updated);
    setRescheduleTarget(null);
  };

  const upcoming = bookings.filter((b) => ["confirmed", "held", "swap_pending"].includes(b.state));
  const past     = bookings.filter((b) => ["cancelled", "completed"].includes(b.state));

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 fade-in-up">

      {/* Back */}
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-hillingdon-navy mb-6 transition font-medium">
        <ArrowLeft size={14} /> Back to search
      </button>

      {/* Hero */}
      <div className="mb-7">
        <h1 className="text-[26px] font-black text-gray-900 tracking-tight">My Bookings</h1>
        <p className="text-[14px] text-gray-500 mt-0.5">
          {loading ? "Loading…" : `${upcoming.length} upcoming · ${past.length} past`}
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-6 rounded-2xl border p-4 flex items-start gap-3 animate-slide-down ${
          toast.type === "error" ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
        }`}>
          {toast.type === "error"
            ? <AlertTriangle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            : <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
          }
          <div className="flex-1">
            {toast.type === "cancel" && (
              <>
                <p className="text-[14px] font-bold text-gray-900">Booking cancelled</p>
                <p className="text-[13px] text-gray-600 mt-0.5">
                  {toast.data.refunded
                    ? `Your refund of ${toast.data.amount} will appear in your account within 5–10 business days.`
                    : "Your booking has been cancelled. No payment was taken."}
                </p>
              </>
            )}
            {toast.type === "reschedule" && (
              <>
                <p className="text-[14px] font-bold text-gray-900">Booking rescheduled</p>
                <p className="text-[13px] text-gray-600 mt-0.5">
                  New time: {fmt(toast.data.start_time, { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(toast.data.start_time)} – {fmtTime(toast.data.end_time)}
                </p>
              </>
            )}
            {toast.type === "error" && (
              <p className="text-[13px] text-red-700">{toast.data.message}</p>
            )}
          </div>
          <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <div className="skeleton h-4 w-40 rounded" />
              <div className="skeleton h-3 w-28 rounded" />
              <div className="skeleton h-3 w-56 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && bookings.length === 0 && (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-[16px] font-bold text-gray-800 mb-1">No bookings yet</p>
          <p className="text-[13px] text-gray-500 mb-5">Your confirmed reservations will appear here.</p>
          <button onClick={onBack} className="btn-primary">Book a space</button>
        </div>
      )}

      {/* Upcoming */}
      {!loading && upcoming.length > 0 && (
        <section className="mb-8">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Upcoming</p>
          <div className="space-y-3">
            {upcoming.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                onCancel={() => setCancelTarget(b)}
                onReschedule={() => setRescheduleTarget(b)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Past */}
      {!loading && past.length > 0 && (
        <section>
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Past</p>
          <div className="space-y-3">
            {past.map((b) => <BookingCard key={b.id} booking={b} />)}
          </div>
        </section>
      )}

      {/* Cancel modal */}
      {cancelTarget && (
        <Modal onClose={() => !cancelling && setCancelTarget(null)}>
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <h3 className="text-[18px] font-bold text-gray-900 mb-1">Cancel this booking?</h3>
          <p className="text-[13px] text-gray-500 mb-4">
            {cancelTarget.asset?.name} · {fmt(cancelTarget.start_time, { weekday: "long", day: "numeric", month: "long" })}
            <br />
            {fmtTime(cancelTarget.start_time)} – {fmtTime(cancelTarget.end_time)}
          </p>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 mb-6">
            <p className="text-[13px] text-emerald-800 font-medium">Any payment will be fully refunded within 5–10 business days.</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setCancelTarget(null)} disabled={cancelling} className="btn-secondary flex-1">
              Keep booking
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold rounded-xl px-4 py-2.5 transition flex items-center justify-center gap-2"
            >
              {cancelling ? <RefreshCw size={14} className="animate-spin" /> : <X size={14} />}
              {cancelling ? "Cancelling…" : "Yes, cancel it"}
            </button>
          </div>
        </Modal>
      )}

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <RescheduleModal
          booking={rescheduleTarget}
          user={user}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={handleRescheduled}
        />
      )}
    </div>
  );
}

/* ── booking card ────────────────────────────────────────────── */
function BookingCard({ booking, onCancel, onReschedule }) {
  const isPast = ["cancelled", "completed"].includes(booking.state);
  const badge  = BADGE[booking.state] || BADGE.completed;
  const label  = BADGE_LABEL[booking.state] || booking.state;

  return (
    <div className={`bg-white border rounded-2xl overflow-hidden transition ${isPast ? "border-gray-100 opacity-60" : "border-gray-200 shadow-sm hover:shadow-md"}`}>
      {/* Top accent for upcoming */}
      {!isPast && <div className="h-1 bg-gradient-to-r from-hillingdon-navy to-blue-500" />}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-gray-900 truncate">{booking.asset?.name || "Unknown venue"}</p>
            <p className="text-[12px] text-gray-400">{booking.asset?.ward ? `${booking.asset.ward}, Hillingdon` : ""}</p>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${badge}`}>{label}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <Calendar size={12} className="text-gray-400 flex-shrink-0" />
            {fmt(booking.start_time, { weekday: "short", day: "numeric", month: "short" })}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <Clock size={12} className="text-gray-400 flex-shrink-0" />
            {fmtTime(booking.start_time)} – {fmtTime(booking.end_time)}
          </div>
          {booking.asset?.ward && (
            <div className="flex items-center gap-2 text-[12px] text-gray-500 col-span-2">
              <MapPin size={12} className="text-gray-400 flex-shrink-0" />
              {booking.asset.ward}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-gray-300">{booking.reference}</span>
          {!isPast && onCancel && (
            <div className="flex items-center gap-2">
              {onReschedule && (
                <button
                  onClick={onReschedule}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-hillingdon-navy hover:bg-hillingdon-navy-tint px-3 py-1.5 rounded-lg transition"
                >
                  <Edit2 size={12} /> Edit time
                </button>
              )}
              <button
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition"
              >
                <X size={12} /> Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── reschedule modal ────────────────────────────────────────── */
function RescheduleModal({ booking, user, onClose, onSuccess }) {
  const startDate = new Date(booking.start_time);
  const endDate   = new Date(booking.end_time);

  const toDateInput = (d) => d.toISOString().slice(0, 10);
  const toTimeInput = (d) => d.toTimeString().slice(0, 5);

  const [date, setDate]       = useState(toDateInput(startDate));
  const [startT, setStartT]   = useState(toTimeInput(startDate));
  const [endT, setEndT]       = useState(toTimeInput(endDate));
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState(null);

  const handleSave = async () => {
    setError(null);
    if (startT >= endT) { setError("End time must be after start time."); return; }
    setSaving(true);
    try {
      const newStart = new Date(`${date}T${startT}:00`).toISOString();
      const newEnd   = new Date(`${date}T${endT}:00`).toISOString();
      const updated  = await api.rescheduleBooking(booking.id, user.id, newStart, newEnd);
      onSuccess({ ...booking, ...updated });
    } catch (err) {
      setError(err.message.includes("slot_unavailable")
        ? "That time slot is already taken. Please choose a different time."
        : err.message);
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Modal onClose={() => !saving && onClose()}>
      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-4">
        <Edit2 size={18} className="text-hillingdon-navy" />
      </div>
      <h3 className="text-[18px] font-bold text-gray-900 mb-1">Reschedule booking</h3>
      <p className="text-[13px] text-gray-500 mb-5">{booking.asset?.name}</p>

      <div className="space-y-4 mb-5">
        <div>
          <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Date</label>
          <input
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-hillingdon-navy/20 focus:border-hillingdon-navy"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">Start time</label>
            <input
              type="time"
              value={startT}
              onChange={(e) => setStartT(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-hillingdon-navy/20 focus:border-hillingdon-navy"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-600 mb-1.5">End time</label>
            <input
              type="time"
              value={endT}
              onChange={(e) => setEndT(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-hillingdon-navy/20 focus:border-hillingdon-navy"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-[13px] text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button onClick={onClose} disabled={saving} className="btn-secondary flex-1">Cancel</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
          {saving ? <><RefreshCw size={14} className="animate-spin" /> Saving…</> : <>Save changes</>}
        </button>
      </div>
    </Modal>
  );
}

/* ── shared modal shell ──────────────────────────────────────── */
function Modal({ children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div ref={ref} className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-2xl animate-scale-in">
        {children}
      </div>
    </div>
  );
}
