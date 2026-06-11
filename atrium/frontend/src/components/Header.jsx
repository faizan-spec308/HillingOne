import { useEffect, useRef, useState } from "react";
import { Bell, BookOpen, ChevronDown, LogOut, Shield, Globe, Settings, X, Clock, Home } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../api/client";

export default function Header({ userName, role, isStaff }) {
  const { logout } = useAuth();
  const { lang, setLang, t, languages } = useLanguage();
  const { isDark } = useTheme();
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
    const interval = setInterval(fetchReminders, 60_000);
    return () => clearInterval(interval);
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
    { path: "/",      label: t("nav_resident"), icon: null },
    { path: "/staff", label: t("nav_staff"),    icon: <Shield size={11} />, staffOnly: true },
  ].filter((tab) => !tab.staffOnly || isStaff);

  // Treat all booking-flow sub-paths as "/"
  const FLOW_PATHS = new Set(["/search", "/results", "/hold", "/pay", "/confirmed"]);
  const activePath = FLOW_PATHS.has(location.pathname) ? "/" : location.pathname;

  return (
    <header
      className="sticky top-0 z-30"
      style={{
        background: isDark ? "#0E1117" : "#ffffff",
        borderBottom: `1px solid ${isDark ? "#21262D" : "#E2E8F0"}`,
        boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.05)",
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
            style={{ background: "linear-gradient(135deg, #0F766E, #0D9488)" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div className="text-left">
            <div className="hidden sm:block text-[10px] font-semibold leading-none tracking-widest uppercase" style={{ color: isDark ? "#484F58" : "#9CA3AF" }}>Hillingdon Council</div>
            <div className="text-[16px] font-display font-bold leading-tight" style={{ color: isDark ? "#E6EDF3" : "#111827" }}>HillingOne</div>
          </div>
        </button>

        {/* Nav tabs — hidden on mobile */}
        <nav className="hidden sm:flex items-center rounded-xl p-1 gap-0.5" style={{ background: isDark ? "#21262D" : "#F3F4F6" }}>
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
              style={{ color: isDark ? "#8B949E" : "#9CA3AF" }}
            >
              <Globe size={18} />
              <span className="text-[11px] font-bold uppercase hidden sm:block tracking-wide">
                {lang}
              </span>
            </button>

            {langOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-44 rounded-2xl overflow-hidden z-50"
                style={{
                  background: isDark ? "#161B22" : "#ffffff",
                  border: `1px solid ${isDark ? "#30363D" : "#F3F4F6"}`,
                  boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)",
                }}
              >
                {Object.entries(languages).map(([code, { name }]) => (
                  <button
                    key={code}
                    onClick={() => { setLang(code); setLangOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition text-left"
                    style={lang === code
                      ? { background: isDark ? "rgba(13,148,136,0.12)" : "#F0FDFA", color: "#0D9488", fontWeight: 600 }
                      : { color: isDark ? "#8B949E" : "#374151" }
                    }
                  >
                    <span className="flex-1">{name}</span>
                    {lang === code && (
                      <span className="text-[11px] font-black" style={{ color: "#0D9488" }}>✓</span>
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
              style={{ color: isDark ? "#8B949E" : "#9CA3AF" }}
            >
              <Bell size={18} />
              {reminders.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {reminders.length > 9 ? "9+" : reminders.length}
                </span>
              )}
            </button>

            {bellOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-80 rounded-2xl overflow-hidden z-50"
                style={{
                  background: isDark ? "#161B22" : "#ffffff",
                  border: `1px solid ${isDark ? "#30363D" : "#F3F4F6"}`,
                  boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)",
                }}
              >
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${isDark ? "#30363D" : "#F3F4F6"}` }}>
                  <p className="text-[13px] font-bold" style={{ color: isDark ? "#E6EDF3" : "#111827" }}>Notifications</p>
                </div>

                {reminders.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Bell size={24} className="mx-auto mb-2" style={{ color: isDark ? "#30363D" : "#D1D5DB" }} />
                    <p className="text-[13px]" style={{ color: isDark ? "#484F58" : "#9CA3AF" }}>No new notifications</p>
                  </div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {reminders.map((r) => (
                      <div
                        key={r.id}
                        className="px-4 py-3 flex items-start gap-3 transition"
                        style={{ borderBottom: `1px solid ${isDark ? "#21262D" : "#F9FAFB"}` }}
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: "linear-gradient(135deg, #0F766E, #0D9488)" }}>
                          <Clock size={13} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] leading-relaxed" style={{ color: isDark ? "#C9D1D9" : "#374151" }}>{r.message}</p>
                          {r.encouragement && (
                            <p className="text-[11px] mt-1 italic leading-relaxed" style={{ color: isDark ? "#8B949E" : "#9CA3AF" }}>{r.encouragement}</p>
                          )}
                        </div>
                        <button
                          onClick={() => dismissReminder(r.id)}
                          className="flex-shrink-0 mt-0.5"
                          style={{ color: isDark ? "#484F58" : "#D1D5DB" }}
                          aria-label="Dismiss"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {reminders.length > 0 && (
                  <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${isDark ? "#30363D" : "#F3F4F6"}` }}>
                    <button
                      onClick={() => { reminders.forEach((r) => dismissReminder(r.id)); }}
                      className="text-[12px] text-teal-600 hover:underline font-medium"
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
              style={{ borderLeft: `1px solid ${isDark ? "#21262D" : "#E5E7EB"}` }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                style={{
                  background: isStaff
                    ? "linear-gradient(135deg, #0F766E, #0D9488)"
                    : "linear-gradient(135deg, #059669, #10B981)",
                }}
              >
                {initials}
              </div>
              <div className="hidden sm:block leading-tight text-left">
                <div className="text-[13px] font-semibold" style={{ color: isDark ? "#E6EDF3" : "#111827" }}>{userName}</div>
                <div className="text-[11px] capitalize" style={{ color: isDark ? "#8B949E" : "#9CA3AF" }}>{role}</div>
              </div>
              <ChevronDown
                size={13}
                className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                style={{ color: isDark ? "#8B949E" : "#9CA3AF" }}
              />
            </button>

            {dropdownOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden z-50"
                style={{
                  background: isDark ? "#161B22" : "#ffffff",
                  border: `1px solid ${isDark ? "#30363D" : "#F3F4F6"}`,
                  boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)",
                }}
              >
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${isDark ? "#21262D" : "#F3F4F6"}` }}>
                  <p className="text-[13px] font-bold" style={{ color: isDark ? "#E6EDF3" : "#111827" }}>{userName}</p>
                  <p className="text-[11px] capitalize" style={{ color: isDark ? "#8B949E" : "#9CA3AF" }}>{role}</p>
                </div>
                {[
                  { label: t("nav_resident"), icon: Home,    path: "/",         mobileOnly: true },
                  { label: t("nav_staff"),    icon: Shield,  path: "/staff",    mobileOnly: true, staffOnly: true },
                  { label: t("nav_my_bookings"), icon: BookOpen, path: "/bookings" },
                  { label: "Settings",        icon: Settings, path: "/settings" },
                ].filter(item => (!item.staffOnly || isStaff)).map(({ label, icon: Icon, path, mobileOnly }) => (
                  <button
                    key={path}
                    onClick={() => { setDropdownOpen(false); navigate(path); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-[13px] transition text-left${mobileOnly ? " sm:hidden" : ""}`}
                    style={{ color: isDark ? "#C9D1D9" : "#374151" }}
                  >
                    <Icon size={14} style={{ color: isDark ? "#8B949E" : "#9CA3AF" }} />
                    {label}
                  </button>
                ))}
                <div style={{ borderTop: `1px solid ${isDark ? "#21262D" : "#F3F4F6"}` }} />
                <button
                  onClick={() => { setDropdownOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-red-500 hover:bg-red-50/10 transition text-left"
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
