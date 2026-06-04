import { Bell, ShieldCheck } from "lucide-react";

export default function Header({ view, onViewChange, userName, role }) {
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const isStaff = role === "staff" || role === "admin";

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      {/* Top brand strip */}
      <div className="bg-hillingdon-navy px-6 py-1.5 flex items-center gap-2">
        <ShieldCheck size={12} className="text-white/60" />
        <span className="text-[11px] text-white/70 tracking-wide">
          Official digital service · London Borough of Hillingdon
        </span>
      </div>

      {/* Main header row */}
      <div className="px-6 py-3 flex items-center justify-between gap-4">

        {/* Wordmark */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-hillingdon-navy rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <div className="text-[11px] font-medium text-gray-400 leading-none tracking-wide uppercase">
              Hillingdon Council
            </div>
            <div className="text-[17px] font-bold text-gray-900 leading-tight tracking-tight">
              Atrium
            </div>
          </div>
        </div>

        {/* Nav switcher */}
        <nav className="flex items-center bg-gray-100 rounded-xl p-1 gap-0.5" role="tablist" aria-label="Switch view">
          {[
            { key: "resident",    label: "Resident" },
            { key: "my-bookings", label: "My Bookings" },
            { key: "staff",       label: "Staff" },
          ].map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              onClick={() => onViewChange(key)}
              className={`nav-tab ${view === key ? "active" : ""}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right: notification + user */}
        <div className="flex items-center gap-2">
          <button
            aria-label="Notifications"
            className="relative p-2 text-gray-500 hover:text-hillingdon-navy hover:bg-hillingdon-navy-tint rounded-xl transition"
          >
            <Bell size={18} />
          </button>

          <div className="flex items-center gap-2.5 pl-2 border-l border-gray-200 ml-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"
              style={{
                background: isStaff
                  ? "linear-gradient(135deg, #153D6E, #1B4F8C)"
                  : "linear-gradient(135deg, #059669, #10B981)",
              }}
            >
              {initials}
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="text-[13px] font-semibold text-gray-900">{userName}</div>
              <div className="text-[11px] text-gray-500 capitalize">{role}</div>
            </div>
          </div>
        </div>

      </div>
    </header>
  );
}
