import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X, CalendarCheck } from "lucide-react";
import { api } from "../api/client";
import { useTheme } from "../context/ThemeContext";

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
  const { isDark } = useTheme();
  const [weekStart, setWeekStart]   = useState(() => getMondayOf(new Date()));
  const [bookings, setBookings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(false);
  const [selected, setSelected]     = useState(null); // { date, hour }

  const t1  = isDark ? "#E6EDF3" : "#111827";
  const t2  = isDark ? "#8B949E" : "#6B7280";
  const t3  = isDark ? "#484F58" : "#9CA3AF";
  const bdr = isDark ? "#30363D" : "#E5E7EB";
  const bdrLight = isDark ? "#21262D" : "#F3F4F6";
  const card = isDark ? "#161B22" : "#ffffff";
  const past = isDark ? "#1C2029" : "#F9FAFB";

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    setSelected(null);
    const from = isoDate(weekStart);
    const to   = isoDate(addDays(weekStart, 7));
    api.getAssetAvailability(asset.id, from, to)
      .then(setBookings)
      .catch(() => setLoadError(true))
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
      role="dialog"
      aria-modal="true"
      aria-label={`Availability calendar for ${asset.name}`}
    >
      <div className="rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ background: card, border: `1px solid ${bdr}` }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${bdrLight}` }}>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: t3 }}>Availability</p>
            <h2 className="text-[16px] font-black truncate" style={{ color: t1 }}>{asset.name}</h2>
          </div>

          {/* Week navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(w => addDays(w, -7))}
              disabled={!canGoPrev}
              aria-label="Previous week"
              className="p-1.5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition"
              style={{ color: t2 }}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-semibold min-w-[160px] text-center" style={{ color: t1 }}>
              {fmtWeek(weekStart)}
            </span>
            <button
              onClick={() => setWeekStart(w => addDays(w, 7))}
              aria-label="Next week"
              className="p-1.5 rounded-lg transition"
              style={{ color: t2 }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button onClick={onClose} aria-label="Close calendar" className="p-1.5 rounded-lg transition" style={{ color: t2 }}>
            <X size={16} />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-[13px]" style={{ color: t2 }}>Loading availability…</div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-[13px]" style={{ color: t2 }}>Couldn't load availability. Please try again.</p>
              <button onClick={() => setWeekStart(w => new Date(w))} className="btn-secondary text-[13px]">Retry</button>
            </div>
          ) : (
            <table className="w-full border-collapse text-[12px]">
              <thead className="sticky top-0 z-10" style={{ background: card, borderBottom: `1px solid ${bdrLight}` }}>
                <tr>
                  <th className="w-14 px-3 py-2 text-left text-[11px] font-semibold" style={{ color: t2 }} />
                  {days.map((d, i) => {
                    const isToday = isoDate(d) === isoDate(new Date());
                    return (
                      <th key={i} className="px-1 py-2 text-center font-semibold" style={{ color: isToday ? "#0D9488" : t1 }}>
                        <div className="text-[11px] uppercase tracking-wide" style={{ color: isToday ? "#2DD4BF" : t2 }}>
                          {fmtDay(d)}
                        </div>
                        <div className={`text-[14px] font-black mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full ${isToday ? "bg-teal-600 text-white" : ""}`}>
                          {d.getDate()}
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: isToday ? "#2DD4BF" : t3 }}>
                          {fmtDate(d).split(" ")[1]}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour} style={{ borderTop: `1px solid ${bdrLight}` }}>
                    <td className="px-3 py-0 text-[11px] font-medium text-right align-top pt-1 w-14" style={{ color: t2 }}>
                      {fmtHour(hour)}
                    </td>
                    {days.map((d, di) => {
                      const isPast = isSlotPast(d, hour);
                      const booked = !isPast && isSlotBooked(d, hour, bookings);
                      const sel    = selected?.date === isoDate(d) && selected?.hour === hour;
                      const free   = !isPast && !booked;

                      let slotStyle = { border: "none", padding: 0 };
                      let slotClass = "w-full h-8 rounded-md transition-all duration-100 flex items-center justify-center text-[10px] font-semibold";
                      if (isPast) {
                        slotStyle = { ...slotStyle, background: past, cursor: "default" };
                      } else if (booked) {
                        slotStyle = { ...slotStyle, background: isDark ? "rgba(13,148,136,0.08)" : "#F0FDFA", border: `1px solid ${isDark ? "#0F766E40" : "#99F6E4"}`, cursor: "not-allowed" };
                      } else if (sel) {
                        slotStyle = { ...slotStyle, background: "#0D9488", cursor: "pointer" };
                        slotClass += " text-white shadow-sm";
                      } else {
                        slotStyle = { ...slotStyle, background: "transparent", cursor: "pointer" };
                        slotClass += " hover:bg-emerald-50 hover:border hover:border-emerald-200";
                      }

                      const slotLabel = `${fmtDay(d)} ${fmtDate(d)}, ${fmtHour(hour)} – ${fmtHour(hour + 1)}`;
                      return (
                        <td key={di} className="px-0.5 py-0.5">
                          <button
                            type="button"
                            onClick={() => free && handleSlotClick(d, hour)}
                            disabled={!free}
                            aria-label={free ? `Select free slot ${slotLabel}` : `${slotLabel} unavailable`}
                            aria-pressed={sel || undefined}
                            className={slotClass}
                            style={slotStyle}
                          >
                            {booked && <span style={{ color: isDark ? "#2DD4BF" : "#5EEAD4" }}>·</span>}
                            {sel    && <CalendarCheck size={12} />}
                          </button>
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
        <div className="px-5 py-4 flex items-center gap-4" style={{ borderTop: `1px solid ${bdrLight}` }}>
          <div className="flex items-center gap-4 text-[11px]" style={{ color: t2 }}>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: isDark ? "rgba(13,148,136,0.08)" : "#F0FDFA", border: `1px solid ${isDark ? "#0F766E40" : "#99F6E4"}` }} /> Booked
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-teal-600 inline-block" /> Selected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: past, border: `1px solid ${bdrLight}` }} /> Unavailable
            </span>
          </div>
          <div className="flex-1" />
          {selected ? (
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold" style={{ color: t1 }}>
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
            <p className="text-[12px] italic" style={{ color: t3 }}>Click a free slot to select it</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
