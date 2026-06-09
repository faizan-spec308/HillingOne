import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, CalendarCheck } from "lucide-react";
import { api } from "../api/client";

const HOUR_START = 8;   // 08:00
const HOUR_END   = 22;  // 22:00 (last slot starts at 21:00)
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSlotBooked(date, hour, bookings) {
  const slotStart = new Date(date);
  slotStart.setHours(hour, 0, 0, 0);
  const slotEnd = new Date(slotStart);
  slotEnd.setHours(hour + 1);
  return bookings.some(b => {
    const bs = new Date(b.start_time);
    const be = new Date(b.end_time);
    return bs < slotEnd && be > slotStart;
  });
}

function isSlotPast(date, hour) {
  const slotStart = new Date(date);
  slotStart.setHours(hour, 0, 0, 0);
  return slotStart <= new Date();
}

export default function AssetCalendar({ asset, onClose, onSelectSlot }) {
  const [weekStart, setWeekStart]   = useState(() => getMondayOf(new Date()));
  const [bookings, setBookings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState(null); // { date, hour }

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    const from = isoDate(weekStart);
    const to   = isoDate(addDays(weekStart, 7));
    api.getAssetAvailability(asset.id, from, to)
      .then(setBookings)
      .finally(() => setLoading(false));
  }, [asset.id, weekStart]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = getMondayOf(new Date());
  const canGoPrev = weekStart > today;

  const handleSlotClick = (date, hour) => {
    if (isSlotPast(date, hour) || isSlotBooked(date, hour, bookings)) return;
    setSelected({ date: isoDate(date), hour });
  };

  const handleBook = () => {
    if (!selected) return;
    const start = new Date(`${selected.date}T${String(selected.hour).padStart(2, "0")}:00:00`);
    const end   = new Date(start);
    end.setHours(end.getHours() + 1);
    onSelectSlot(asset, start.toISOString(), end.toISOString());
  };

  const fmtDay   = (d) => d.toLocaleDateString("en-GB", { weekday: "short" });
  const fmtDate  = (d) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const fmtHour  = (h) => `${String(h).padStart(2, "0")}:00`;
  const fmtWeek  = (d) => {
    const end = addDays(d, 6);
    return `${d.getDate()} – ${end.getDate()} ${end.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(4px)", background: "rgba(15,23,42,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Availability</p>
            <h2 className="text-[16px] font-black text-gray-900 truncate">{asset.name}</h2>
          </div>

          {/* Week navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(w => addDays(w, -7))}
              disabled={!canGoPrev}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-semibold text-gray-700 min-w-[160px] text-center">
              {fmtWeek(weekStart)}
            </span>
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
            <X size={16} />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-[13px] text-gray-400">Loading availability…</div>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <tr>
                  <th className="w-14 px-3 py-2 text-left text-[11px] text-gray-400 font-semibold" />
                  {days.map((d, i) => {
                    const isToday = isoDate(d) === isoDate(new Date());
                    return (
                      <th key={i} className={`px-1 py-2 text-center font-semibold ${isToday ? "text-teal-700" : "text-gray-600"}`}>
                        <div className={`text-[11px] uppercase tracking-wide ${isToday ? "text-teal-500" : "text-gray-400"}`}>
                          {fmtDay(d)}
                        </div>
                        <div className={`text-[14px] font-black mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full ${isToday ? "bg-teal-600 text-white" : ""}`}>
                          {d.getDate()}
                        </div>
                        <div className={`text-[10px] mt-0.5 ${isToday ? "text-teal-400" : "text-gray-300"}`}>
                          {fmtDate(d).split(" ")[1]}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour} className="border-t border-gray-50">
                    <td className="px-3 py-0 text-[11px] text-gray-400 font-medium text-right align-top pt-1 w-14">
                      {fmtHour(hour)}
                    </td>
                    {days.map((d, di) => {
                      const past   = isSlotPast(d, hour);
                      const booked = !past && isSlotBooked(d, hour, bookings);
                      const sel    = selected?.date === isoDate(d) && selected?.hour === hour;
                      const free   = !past && !booked;

                      return (
                        <td key={di} className="px-0.5 py-0.5">
                          <div
                            onClick={() => free && handleSlotClick(d, hour)}
                            className={`h-8 rounded-md transition-all duration-100 flex items-center justify-center text-[10px] font-semibold
                              ${past   ? "bg-gray-50 cursor-default" : ""}
                              ${booked ? "bg-teal-50 border border-teal-100 cursor-not-allowed" : ""}
                              ${free && !sel ? "hover:bg-emerald-50 hover:border hover:border-emerald-200 cursor-pointer" : ""}
                              ${sel   ? "bg-teal-600 text-white shadow-sm cursor-pointer" : ""}
                            `}
                          >
                            {booked && <span className="text-teal-300">·</span>}
                            {sel    && <CalendarCheck size={12} />}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-4">
          <div className="flex items-center gap-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-teal-100 border border-teal-200 inline-block" /> Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-teal-600 inline-block" /> Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-50 border border-gray-100 inline-block" /> Unavailable
            </span>
          </div>
          <div className="flex-1" />
          {selected ? (
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-gray-600 font-semibold">
                {new Date(`${selected.date}T${String(selected.hour).padStart(2,"0")}:00`).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})}
                {" · "}
                {fmtHour(selected.hour)} – {fmtHour(selected.hour + 1)}
              </span>
              <button onClick={handleBook} className="btn-primary text-[13px] px-5">
                <CalendarCheck size={14} />
                Book this slot
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-gray-400 italic">Click a free slot to select it</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
