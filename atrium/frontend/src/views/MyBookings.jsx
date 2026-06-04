import { useEffect, useState } from "react";
import { Calendar, MapPin, Clock, X, ArrowLeft, CheckCircle2, Ban, RefreshCw } from "lucide-react";
import { api } from "../api/client";

const STATE_LABEL = {
  confirmed:    { label: "Confirmed",    color: "bg-emerald-100 text-emerald-700" },
  held:         { label: "Held",         color: "bg-amber-100 text-amber-700" },
  cancelled:    { label: "Cancelled",    color: "bg-red-100 text-red-600" },
  completed:    { label: "Completed",    color: "bg-gray-100 text-gray-500" },
  swap_pending: { label: "Swap pending", color: "bg-blue-100 text-blue-700" },
};

export default function MyBookings({ user, onBack }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState(null);

  useEffect(() => {
    api.listUserBookings(user.id)
      .then(setBookings)
      .finally(() => setLoading(false));
  }, [user.id]);

  const handleCancel = async (booking) => {
    setCancelling(true);
    try {
      const res = await api.cancelBooking(booking.id, user.id);
      setCancelResult(res.refund || null);
      setBookings((prev) =>
        prev.map((b) => b.id === booking.id ? { ...b, state: "cancelled" } : b)
      );
    } catch (err) {
      setCancelResult({ error: err.message });
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const active = bookings.filter((b) => ["confirmed", "held", "swap_pending"].includes(b.state));
  const past   = bookings.filter((b) => ["cancelled", "completed"].includes(b.state));

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 fade-in-up">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-hillingdon-navy mb-6 transition font-medium"
      >
        <ArrowLeft size={15} />
        Back
      </button>

      <h1 className="text-[22px] font-black text-gray-900 mb-1">My Bookings</h1>
      <p className="text-[14px] text-gray-500 mb-7">Manage and cancel your space reservations.</p>

      {/* Refund toast */}
      {cancelResult && (
        <div className={`mb-6 p-4 rounded-xl border flex items-start gap-3 ${cancelResult.error ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
          {cancelResult.error
            ? <Ban size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            : <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 flex-shrink-0" />
          }
          <div>
            <p className="text-[13px] font-semibold text-gray-900 mb-0.5">
              {cancelResult.error ? "Cancellation error" : "Booking cancelled"}
            </p>
            <p className="text-[13px] text-gray-600">
              {cancelResult.error || (cancelResult.refunded
                ? `${cancelResult.amount} refund issued to your card.`
                : "No payment was found — nothing to refund.")}
            </p>
          </div>
          <button onClick={() => setCancelResult(null)} className="ml-auto text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4">
              <div className="skeleton w-12 h-12 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="skeleton h-4 w-36 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
                <div className="skeleton h-3 w-48 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-[15px] font-semibold text-gray-700 mb-1">No bookings yet</p>
          <p className="text-[13px] text-gray-500">Your confirmed bookings will appear here.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-8">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Upcoming</h2>
              <div className="space-y-3">
                {active.map((b) => <BookingCard key={b.id} booking={b} onCancel={() => setCancelTarget(b)} />)}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Past</h2>
              <div className="space-y-3">
                {past.map((b) => <BookingCard key={b.id} booking={b} onCancel={null} />)}
              </div>
            </section>
          )}
        </>
      )}

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full shadow-xl">
            <h3 className="text-[17px] font-bold text-gray-900 mb-2">Cancel this booking?</h3>
            <p className="text-[13px] text-gray-600 mb-1">
              <strong>{cancelTarget.asset?.name}</strong>
            </p>
            <p className="text-[13px] text-gray-500 mb-5">
              {new Date(cancelTarget.start_time).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              {" · "}
              {new Date(cancelTarget.start_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              {" – "}
              {new Date(cancelTarget.end_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 mb-5">
              Any payment made will be fully refunded.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelTarget(null)} className="btn-secondary flex-1" disabled={cancelling}>
                Keep booking
              </button>
              <button onClick={() => handleCancel(cancelTarget)} className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold rounded-xl transition flex items-center justify-center gap-2" disabled={cancelling}>
                {cancelling ? <RefreshCw size={14} className="animate-spin" /> : <X size={14} />}
                {cancelling ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking, onCancel }) {
  const start = new Date(booking.start_time);
  const end   = new Date(booking.end_time);
  const badge = STATE_LABEL[booking.state] || { label: booking.state, color: "bg-gray-100 text-gray-500" };
  const isPast = ["cancelled", "completed"].includes(booking.state);

  return (
    <div className={`bg-white border rounded-2xl p-5 flex gap-4 ${isPast ? "opacity-60" : "border-gray-200"}`}>
      <div className="w-11 h-11 rounded-xl bg-hillingdon-navy-tint flex items-center justify-center flex-shrink-0">
        <MapPin size={18} className="text-hillingdon-navy" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-[14px] font-bold text-gray-900 truncate">{booking.asset?.name || "Unknown venue"}</p>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>
            {badge.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-gray-500 mb-0.5">
          <Calendar size={11} />
          {start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-gray-500 mb-2">
          <Clock size={11} />
          {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} – {end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <p className="text-[11px] font-mono text-gray-400">{booking.reference}</p>
      </div>
      {onCancel && (
        <button
          onClick={onCancel}
          className="self-start text-[12px] text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition font-medium flex-shrink-0"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
