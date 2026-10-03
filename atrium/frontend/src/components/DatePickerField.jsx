import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

/* A lightweight, design-token-themed date picker that replaces the native
   <input type="date"> dropdown. Portal-rendered so it never clips inside
   modals or scroll containers. Value/onChange use "YYYY-MM-DD" strings, so it
   is a drop-in for the native input the booking flow used before. */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n) => String(n).padStart(2, "0");
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m is 0-indexed
const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m: m - 1, d };
};
const atMidnight = (y, m, d) => new Date(y, m, d, 0, 0, 0, 0);

export default function DatePickerField({ value, min, onChange, id }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, flipUp: false });
  const triggerRef = useRef(null);
  const popRef = useRef(null);

  const selected = parseISO(value);
  const minDate = (() => {
    const p = parseISO(min);
    return p ? atMidnight(p.y, p.m, p.d) : null;
  })();

  const initial = selected || (() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() }; })();
  const [viewY, setViewY] = useState(initial.y);
  const [viewM, setViewM] = useState(initial.m);

  // Keep the visible month in sync when the value changes from outside.
  useEffect(() => {
    if (selected) { setViewY(selected.y); setViewM(selected.m); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const position = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const popH = 330;
    const flipUp = r.bottom + popH > window.innerHeight && r.top > popH;
    setCoords({
      top: flipUp ? r.top - popH - 8 : r.bottom + 8,
      left: r.left,
      width: r.width,
      flipUp,
    });
  };

  useLayoutEffect(() => { if (open) position(); }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = () => position();
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onScroll);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const leadBlanks = (new Date(viewY, viewM, 1).getDay() + 6) % 7; // Monday-first
  const cells = [...Array(leadBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const isDisabled = (day) => minDate && atMidnight(viewY, viewM, day) < minDate;
  const isSelected = (day) => selected && selected.y === viewY && selected.m === viewM && selected.d === day;
  const today = new Date();
  const isToday = (day) => today.getFullYear() === viewY && today.getMonth() === viewM && today.getDate() === day;

  const prevMonth = () => { const m = viewM - 1; if (m < 0) { setViewM(11); setViewY(viewY - 1); } else setViewM(m); };
  const nextMonth = () => { const m = viewM + 1; if (m > 11) { setViewM(0); setViewY(viewY + 1); } else setViewM(m); };

  const pick = (day) => {
    if (isDisabled(day)) return;
    onChange(toISO(viewY, viewM, day));
    setOpen(false);
  };

  const label = selected
    ? atMidnight(selected.y, selected.m, selected.d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Select a date";

  return (
    <>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="w-full border rounded-xl px-4 py-3 text-[14px] flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition"
        style={{ background: "var(--bg)", borderColor: open ? "var(--brand)" : "var(--border)", color: selected ? "var(--text-1)" : "var(--text-3)" }}
      >
        <span className="truncate">{label}</span>
        <Calendar size={15} style={{ color: "var(--text-3)", flexShrink: 0 }} />
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label="Choose a date"
          className="fixed z-[10000] rounded-2xl shadow-2xl p-3"
          style={{
            top: coords.top,
            left: coords.left,
            width: Math.max(coords.width, 280),
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            animation: "dpFade 0.12s ease",
          }}
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button type="button" onClick={prevMonth} aria-label="Previous month"
              className="p-1.5 rounded-lg transition hover:bg-black/5" style={{ color: "var(--text-2)" }}>
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-bold" style={{ color: "var(--text-1)" }}>
              {MONTHS[viewM]} {viewY}
            </span>
            <button type="button" onClick={nextMonth} aria-label="Next month"
              className="p-1.5 rounded-lg transition hover:bg-black/5" style={{ color: "var(--text-2)" }}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w) => (
              <div key={w} className="text-center text-[10px] font-bold uppercase tracking-wide py-1" style={{ color: "var(--text-3)" }}>
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`b${i}`} />;
              const disabled = isDisabled(day);
              const sel = isSelected(day);
              const todayMark = isToday(day) && !sel;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => pick(day)}
                  disabled={disabled}
                  aria-pressed={sel || undefined}
                  className="h-9 rounded-lg text-[13px] font-semibold transition flex items-center justify-center disabled:cursor-not-allowed"
                  style={{
                    background: sel ? "var(--brand)" : "transparent",
                    color: sel ? "#fff" : disabled ? "var(--text-3)" : "var(--text-1)",
                    opacity: disabled ? 0.35 : 1,
                    border: todayMark ? "1px solid var(--brand)" : "1px solid transparent",
                  }}
                  onMouseEnter={(e) => { if (!sel && !disabled) e.currentTarget.style.background = "var(--surface-2)"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <style>{`@keyframes dpFade { from { opacity: 0; transform: translateY(${coords.flipUp ? "4px" : "-4px"}); } to { opacity: 1; transform: translateY(0); } }`}</style>
        </div>,
        document.body,
      )}
    </>
  );
}
