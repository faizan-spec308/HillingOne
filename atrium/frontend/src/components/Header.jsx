import { useEffect, useRef, useState } from "react";
import { Bell, BookOpen, ChevronDown, LogOut, Shield, Globe } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

export default function Header({ userName, role, isStaff }) {
  const { logout } = useAuth();
  const { lang, setLang, t, languages } = useLanguage();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [langOpen,     setLangOpen]     = useState(false);
  const dropRef = useRef();
  const langRef = useRef();

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropdownOpen(false);
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
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
      className="bg-white sticky top-0 z-30"
      style={{ borderBottom: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
    >
      <div className="px-6 py-3 flex items-center justify-between gap-4 max-w-7xl mx-auto">

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
            <div className="text-[10px] font-semibold text-gray-400 leading-none tracking-widest uppercase">Hillingdon Council</div>
            <div className="text-[16px] font-display font-bold text-gray-900 leading-tight">Atrium</div>
          </div>
        </button>

        {/* Nav tabs */}
        <nav className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
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
              className="flex items-center gap-1.5 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition"
            >
              <Globe size={18} />
              <span className="text-[11px] font-bold uppercase hidden sm:block tracking-wide">
                {lang}
              </span>
            </button>

            {langOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden z-50">
                {Object.entries(languages).map(([code, { name, flag }]) => (
                  <button
                    key={code}
                    onClick={() => { setLang(code); setLangOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-[13px] transition text-left ${
                      lang === code
                        ? "bg-teal-50 text-teal-700 font-semibold"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-base">{flag}</span>
                    <span className="flex-1">{name}</span>
                    {lang === code && (
                      <span className="text-teal-500 text-[11px] font-black">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications bell */}
          <button className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition">
            <Bell size={18} />
          </button>

          {/* User dropdown */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2.5 pl-3 border-l border-gray-200 ml-1 hover:bg-gray-50 rounded-xl pr-2 py-1.5 transition"
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
                <div className="text-[13px] font-semibold text-gray-900">{userName}</div>
                <div className="text-[11px] text-gray-400 capitalize">{role}</div>
              </div>
              <ChevronDown
                size={13}
                className={`text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-[13px] font-bold text-gray-900">{userName}</p>
                  <p className="text-[11px] text-gray-400 capitalize">{role}</p>
                </div>
                <button
                  onClick={() => { setDropdownOpen(false); navigate("/bookings"); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-gray-700 hover:bg-gray-50 transition text-left"
                >
                  <BookOpen size={14} className="text-gray-400" />
                  {t("nav_my_bookings")}
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => { setDropdownOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-red-500 hover:bg-red-50 transition text-left"
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
