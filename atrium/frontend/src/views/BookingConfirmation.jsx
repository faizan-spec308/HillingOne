import { useEffect, useState } from "react";
import { CheckCircle2, Lock, Calendar, Bell, ArrowLeft, Sparkles, MapPin, Clock, Users } from "lucide-react";
import { api } from "../api/client";

export default function BookingConfirmation({ booking, asset, onBack, encouragement, remindersScheduled }) {
  const [_now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const startTime = new Date(booking.start_time);
  const endTime   = new Date(booking.end_time);

  const dayLabel = startTime.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const timeRange = `${startTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} – ${endTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 fade-in-up">

      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-hillingdon-navy mb-6 transition font-medium"
      >
        <ArrowLeft size={15} />
        Back to search
      </button>

      {/* Main card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-civic-md">

        {/* Success header */}
        <div
          className="px-8 py-10 text-center"
          style={{ background: "linear-gradient(165deg, #ECFDF5 0%, #D1FAE5 100%)" }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"
            style={{ background: "linear-gradient(135deg, #059669, #10B981)" }}
          >
            <CheckCircle2 size={36} className="text-white" />
          </div>
          <h2 className="text-[26px] font-black text-gray-900 mb-1">Booking confirmed</h2>
          <p className="text-[14px] text-gray-600 mb-4">
            Your space is reserved and protected.
          </p>

          {/* Reference number */}
          <div className="inline-flex items-center gap-2 bg-white border border-emerald-200 rounded-xl px-5 py-2.5 shadow-sm">
            <Lock size={14} className="text-emerald-600" />
            <span className="text-[13px] text-gray-600">Reference</span>
            <span className="text-[15px] font-mono font-bold text-gray-900">{booking.reference}</span>
          </div>
        </div>

        {/* Details */}
        <div className="px-8 py-6 space-y-5">

          {/* Venue */}
          <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-10 h-10 rounded-xl bg-hillingdon-navy-tint flex items-center justify-center flex-shrink-0">
              <MapPin size={18} className="text-hillingdon-navy" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Venue</div>
              <div className="text-[16px] font-bold text-gray-900">{asset.name}</div>
              <div className="text-[13px] text-gray-500">{asset.ward}, Hillingdon</div>
            </div>
          </div>

          {/* Time + attendees */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-hillingdon-navy-tint flex items-center justify-center flex-shrink-0">
                <Clock size={16} className="text-hillingdon-navy" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">When</div>
                <div className="text-[13px] font-semibold text-gray-900">{dayLabel}</div>
                <div className="text-[13px] text-gray-500">{timeRange}</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-hillingdon-navy-tint flex items-center justify-center flex-shrink-0">
                <Users size={16} className="text-hillingdon-navy" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Attendees</div>
                <div className="text-[13px] font-semibold text-gray-900">
                  {booking.attendee_count || "Not specified"}
                </div>
              </div>
            </div>
          </div>

          {/* Purpose */}
          {booking.purpose && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Purpose</div>
              <div className="text-[13px] text-gray-800">{booking.purpose}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={api.icsUrl(booking.id)}
              download
              className="btn-primary"
            >
              <Calendar size={15} />
              Add to calendar
            </a>
            {remindersScheduled > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[13px] font-medium">
                <Bell size={14} />
                {remindersScheduled} reminder{remindersScheduled !== 1 ? "s" : ""} scheduled
              </div>
            )}
          </div>

          {/* Encouragement */}
          {encouragement && (
            <div className="p-4 bg-hillingdon-navy-tint border border-blue-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-hillingdon-navy flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-hillingdon-navy uppercase tracking-wide mb-1">
                    A note from Atrium
                  </div>
                  <p className="text-[13px] text-gray-700 leading-relaxed">{encouragement}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trust panel */}
      <div className="mt-5 p-5 bg-white border border-gray-200 rounded-2xl shadow-civic">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-hillingdon-navy flex items-center justify-center flex-shrink-0">
            <Lock size={18} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-[15px] text-gray-900 mb-1.5">Your booking, protected</div>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              This booking can only be cancelled by you, or by staff for a documented operational reason.
              If staff need to cancel, you will be notified immediately with the full reason, an equivalent
              alternative venue, and a 20% goodwill credit on your next booking.
            </p>
            <div className="mt-3 text-[12px] text-gray-400 italic">
              Trust is not built by saying never. It is built by saying always with transparency.
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
