import { useEffect, useRef, useState } from "react";
import { Bell, BookOpen, ChevronDown, LogOut, Shield, Globe, Settings, X, Clock, Home } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { api } from "../api/client";

export default function Header({ userName, role, isStaff }) {
  const { logout } = useAuth();
  const { lang, setLang, t, languages } = useLanguage();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [langOpen,     setLangOpen]     = useState(false);
  const [bellOpen,     setBellOpen]     = useState(false);
  const [reminders,    setReminders]    = useState([]);
  const dropRef = useRef();
  const langRef = useRef();
  const bellRef = useRef();

  // Poll for due reminders every 60 seconds
  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const data = await api.dueReminders();
        setReminders(data);
      } catch {
        // silently ignore — bell is non-critical
      }
    };
    fetchReminders();
    const interval = setInterval(fetchReminders, 20_000);
    const onFocus = () => fetchReminders();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const dismissReminder = async (id) => {
    try {
      await api.dismissReminder(id);
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch {}
  };

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropdownOpen(false);
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tabs = [
    { path: "/",         label: t("nav_resident"),    icon: null },
    { path: "/bookings", label: t("nav_my_bookings"), icon: <BookOpen size={11} /> },
    { path: "/staff",    label: t("nav_staff"),       icon: <Shield size={11} />, staffOnly: true },
  ].filter((tab) => !tab.staffOnly || isStaff);

  // Treat all booking-flow sub-paths as "/"
  const FLOW_PATHS = new Set(["/search", "/results", "/book", "/hold", "/pay", "/confirmed"]);
  const activePath = FLOW_PATHS.has(location.pathname) ? "/" : location.pathname;

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: "var(--header-bg)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div className="px-6 py-3 flex items-center justify-between gap-4 w-full">

        {/* Wordmark */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 min-w-0 focus:outline-none"
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--brand)" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="text-left">
            <div className="hidden sm:block text-[10px] font-semibold leading-none tracking-widest uppercase" style={{ color: "var(--text-3)" }}>Hillingdon Council</div>
            <div className="text-[16px] font-display font-bold leading-tight" style={{ color: "var(--text-1)" }}>HillingOne</div>
          </div>
        </button>

        {/* Nav tabs — hidden on mobile */}
        <nav className="hidden sm:flex items-center rounded-xl p-1 gap-0.5" style={{ background: "var(--surface-2)" }}>
          {tabs.map(({ path, label, icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`nav-tab ${activePath === path ? "active" : ""}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1.5">

          {/* Language switcher */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen((v) => !v)}
              title="Change language"
              className="flex items-center gap-1.5 p-2 rounded-xl transition"
              style={{ color: "var(--text-3)" }}
            >
              <Globe size={18} />
              <span className="text-[11px] font-bold uppercase hidden sm:block tracking-wide">
                {lang}
              </span>
            </button>

            {langOpen && (
              <div className="menu absolute right-0 top-full mt-2 w-44 z-50">
                {Object.entries(languages).map(([code, { name }]) => (
                  <button
                    key={code}
                    onClick={() => { setLang(code); setLangOpen(false); }}
                    className="menu-item"
                    style={lang === code ? { background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 600 } : undefined}
                  >
                    <span className="flex-1">{name}</span>
                    {lang === code && (
                      <span className="text-[11px] font-black" style={{ color: "var(--brand)" }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications bell */}
          <div className="relative" ref={bellRef}>
            <button
              aria-label="Notifications"
              onClick={() => setBellOpen((v) => !v)}
              className="relative p-2 rounded-xl transition"
              style={{ color: "var(--text-3)" }}
            >
              <Bell size={18} />
              {reminders.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {reminders.length > 9 ? "9+" : reminders.length}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="menu absolute right-0 top-full mt-2 w-80 z-50">
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-[13px] font-bold" style={{ color: "var(--text-1)" }}>Notifications</p>
                </div>

                {reminders.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={24} className="mx-auto mb-2" style={{ color: "var(--border-strong)" }} />
                    <p className="text-[13px]" style={{ color: "var(--text-3)" }}>No new notifications</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {reminders.map((r) => (
                      <div
                        key={r.id}
                        className="px-4 py-3 flex items-start gap-3"
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: "var(--brand)" }}>
                          <Clock size={13} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>{r.message}</p>
                          {r.encouragement && (
                            <p className="text-[11px] mt-1 italic leading-relaxed" style={{ color: "var(--text-3)" }}>{r.encouragement}</p>
                          )}
                        </div>
                        <button
                          onClick={() => dismissReminder(r.id)}
                          className="flex-shrink-0 mt-0.5 transition-colors hover:opacity-70"
                          style={{ color: "var(--text-3)" }}
                          aria-label="Dismiss"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {reminders.length > 0 && (
                  <div className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                    <button
                      onClick={() => { reminders.forEach((r) => dismissReminder(r.id)); }}
                      className="text-[12px] font-medium hover:underline"
                      style={{ color: "var(--brand)" }}
                    >
                      Dismiss all
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User dropdown */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2.5 pl-3 ml-1 rounded-xl pr-2 py-1.5 transition"
              style={{ borderLeft: "1px solid var(--border)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                style={{ background: isStaff ? "var(--brand)" : "var(--success)" }}
              >
                {initials}
              </div>
              <div className="hidden sm:block leading-tight text-left">
                <div className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>{userName}</div>
                <div className="text-[11px] capitalize" style={{ color: "var(--text-3)" }}>{role}</div>
              </div>
              <ChevronDown
                size={13}
                className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                style={{ color: "var(--text-3)" }}
              />
            </button>

            {dropdownOpen && (
              <div className="menu absolute right-0 top-full mt-2 w-52 z-50">
                <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-[13px] font-bold" style={{ color: "var(--text-1)" }}>{userName}</p>
                  <p className="text-[11px] capitalize" style={{ color: "var(--text-3)" }}>{role}</p>
                </div>
                {[
                  { label: t("nav_resident"), icon: Home,    path: "/",         mobileOnly: true },
                  { label: t("nav_staff"),    icon: Shield,  path: "/staff",    mobileOnly: true, staffOnly: true },
                  { label: t("nav_my_bookings"), icon: BookOpen, path: "/bookings", mobileOnly: true },
                  { label: "Settings",        icon: Settings, path: "/settings" },
                ].filter(item => (!item.staffOnly || isStaff)).map(({ label, icon: Icon, path, mobileOnly }) => (
                  <button
                    key={path}
                    onClick={() => { setDropdownOpen(false); navigate(path); }}
                    className={`menu-item${mobileOnly ? " sm:hidden" : ""}`}
                  >
                    <Icon size={14} style={{ color: "var(--text-3)" }} />
                    {label}
                  </button>
                ))}
                <div style={{ borderTop: "1px solid var(--border)" }} />
                <button
                  onClick={() => { setDropdownOpen(false); logout(); }}
                  className="menu-item is-danger"
                >
                  <LogOut size={14} />
                  {t("nav_sign_out")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
