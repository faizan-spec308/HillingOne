import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Timer } from "lucide-react";

const IDLE_MS = 2 * 60 * 1000;   // 2 minutes of inactivity → sign out
const WARN_MS = 30 * 1000;        // show the warning this long before logout
const THROTTLE_MS = 1000;         // ignore activity bursts more often than this
const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

export default function IdleLogout() {
  const { user, logout } = useAuth();
  // null = no warning shown; otherwise the seconds remaining before logout.
  const [secondsLeft, setSecondsLeft] = useState(null);

  const lastActivityRef = useRef(Date.now());
  const lastThrottleRef = useRef(0);
  const loggingOutRef   = useRef(false);
  const logoutRef       = useRef(logout);
  logoutRef.current     = logout;

  useEffect(() => {
    if (!user) return;
    lastActivityRef.current = Date.now();
    loggingOutRef.current = false;
    setSecondsLeft(null);

    const onActivity = () => {
      const now = Date.now();
      if (now - lastThrottleRef.current < THROTTLE_MS) return;
      lastThrottleRef.current = now;
      lastActivityRef.current = now;
    };
    EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));

    // A single ticking check that recomputes idle time from a timestamp. This is
    // resilient to background-tab timer throttling: whenever the tab regains the
    // CPU, the elapsed idle time is measured directly and acted on immediately.
    const tick = setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle >= IDLE_MS) {
        if (!loggingOutRef.current) {
          loggingOutRef.current = true;
          logoutRef.current();
        }
      } else if (idle >= IDLE_MS - WARN_MS) {
        setSecondsLeft(Math.max(1, Math.ceil((IDLE_MS - idle) / 1000)));
      } else {
        setSecondsLeft((prev) => (prev === null ? prev : null));
      }
    }, 1000);

    return () => {
      clearInterval(tick);
      EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [user]);

  const staySignedIn = () => {
    lastActivityRef.current = Date.now();
    setSecondsLeft(null);
  };

  if (secondsLeft === null) return null;

  return (
    <div
      className="modal-overlay"
      style={{ background: "rgba(8,11,17,0.65)" }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-desc"
    >
      <div className="modal-panel p-6 max-w-sm">
        <div className="flex flex-col items-center text-center mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: "var(--surface-2)" }}
          >
            <Timer size={22} style={{ color: "var(--brand)" }} />
          </div>
          <h2 id="idle-title" className="text-[18px] font-bold mb-1" style={{ color: "var(--text-1)" }}>
            Still there?
          </h2>
          <p id="idle-desc" className="text-[13px]" style={{ color: "var(--text-2)" }}>
            You've been inactive. For your security, you'll be signed out in:
          </p>
        </div>

        <div className="text-center mb-5">
          <span
            className="text-[52px] font-black tabular-nums leading-none"
            style={{ color: secondsLeft <= 10 ? "var(--danger)" : "var(--brand)" }}
          >
            {secondsLeft}
          </span>
          <span className="text-[15px] ml-1" style={{ color: "var(--text-2)" }}>seconds</span>
        </div>

        <div className="flex gap-3">
          <button onClick={() => logoutRef.current()} className="btn-secondary flex-1 py-2.5">
            Sign out
          </button>
          <button onClick={staySignedIn} className="btn-primary flex-1 py-2.5">
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
