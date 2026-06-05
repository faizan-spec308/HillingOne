import { useEffect, useRef, useState } from "react";
import { Bell, BookOpen, ChevronDown, LogOut, Shield } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Header({ view, onViewChange, userName, role, isStaff, onMyBookings }) {
  const { logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropRef = useRef();

  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const tabs = [
    { key: "resident", label: "Resident", show: true },
    { key: "staff",    label: "Staff",    show: isStaff },
  ].filter((t) => t.show);

  return (
    <header
      className="bg-white sticky top-0 z-30"
      style={{ borderBottom: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
    >
      <div className="px-6 py-3 flex items-center justify-between gap-4 max-w-7xl mx-auto">

        {/* Wordmark */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#0F172A" }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-gray-400 leading-none tracking-widest uppercase">Hillingdon Council</div>
            <div className="text-[16px] font-display font-bold text-gray-900 leading-tight">Atrium</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onViewChange(key)}
              className={`nav-tab ${view === key ? "active" : ""}`}
            >
              {key === "staff" && <Shield size={11} />}
              {label}
            </button>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          <button className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition">
            <Bell size={18} />
          </button>

          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2.5 pl-3 border-l border-gray-200 ml-1 hover:bg-gray-50 rounded-xl pr-2 py-1.5 transition"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
                style={{
                  background: isStaff
                    ? "linear-gradient(135deg, #0F172A, #334155)"
                    : "linear-gradient(135deg, #059669, #10B981)",
                }}
              >
                {initials}
              </div>
              <div className="hidden sm:block leading-tight text-left">
                <div className="text-[13px] font-semibold text-gray-900">{userName}</div>
                <div className="text-[11px] text-gray-400 capitalize">{role}</div>
              </div>
              <ChevronDown size={13} className={`text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-civic-lg overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-[13px] font-bold text-gray-900">{userName}</p>
                  <p className="text-[11px] text-gray-400 capitalize">{role}</p>
                </div>
                <button
                  onClick={() => { setDropdownOpen(false); onMyBookings?.(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-gray-700 hover:bg-gray-50 transition text-left"
                >
                  <BookOpen size={14} className="text-gray-400" />
                  My Bookings
                </button>
                <div className="border-t border-gray-100" />
                <button
                  onClick={() => { setDropdownOpen(false); logout(); }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-[13px] text-red-500 hover:bg-red-50 transition text-left"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
