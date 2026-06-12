import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Timer } from "lucide-react";

const IDLE_MS = 30 * 60 * 1000; // 30 minutes
const WARN_MS = 60 * 1000;       // warn 60 seconds before logout
const THROTTLE_MS = 2000;
const EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];

export default function IdleLogout() {
  const { user, logout } = useAuth();
  const [warning, setWarning]     = useState(false);
  const [secondsLeft, setSeconds] = useState(60);

  const warnRef      = useRef(null);
  const countRef     = useRef(null);
  const lastResetRef = useRef(0);
  const logoutRef    = useRef(logout);
  logoutRef.current  = logout;

  const clearTimers = useCallback(() => {
    clearTimeout(warnRef.current);
    clearInterval(countRef.current);
  }, []);

  const reset = useCallback(() => {
    const now = Date.now();
    if (now - lastResetRef.current < THROTTLE_MS) return;
    lastResetRef.current = now;

    clearTimers();
    setWarning(false);

    warnRef.current = setTimeout(() => {
      setWarning(true);
      setSeconds(60);
      countRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev <= 1) {
            clearInterval(countRef.current);
            logoutRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, IDLE_MS - WARN_MS);
  }, [clearTimers]);

  useEffect(() => {
    if (!user) { clearTimers(); return; }
    reset();
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimers();
      EVENTS.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user, reset, clearTimers]);

  if (!warning) return null;

  const stayLoggedIn = () => {
    lastResetRef.current = 0; // bypass throttle so reset() fires immediately
    reset();
  };

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
        {/* Icon */}
        <div className="flex flex-col items-center text-center mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
            style={{ background: "var(--surface-2)" }}
          >
            <Timer size={22} style={{ color: "var(--brand)" }} />
          </div>
          <h2
            id="idle-title"
            className="text-[18px] font-bold mb-1"
            style={{ color: "var(--text-1)" }}
          >
            Still there?
          </h2>
          <p
            id="idle-desc"
            className="text-[13px]"
            style={{ color: "var(--text-2)" }}
          >
            You've been inactive. For your security, you'll be signed out in:
          </p>
        </div>

        {/* Countdown */}
        <div className="text-center mb-5">
          <span
            className="text-[52px] font-black tabular-nums leading-none"
            style={{ color: secondsLeft <= 10 ? "var(--danger)" : "var(--brand)" }}
          >
            {secondsLeft}
          </span>
          <span className="text-[15px] ml-1" style={{ color: "var(--text-2)" }}>
            seconds
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={logout}
            className="btn-secondary flex-1 py-2.5"
          >
            Sign out
          </button>
          <button
            onClick={stayLoggedIn}
            className="btn-primary flex-1 py-2.5"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
