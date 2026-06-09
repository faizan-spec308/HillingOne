import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, User, Lock, Bell, Moon, Sun, Monitor,
  CheckCircle2, AlertTriangle, ChevronRight, Save,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../api/client";

const WARDS = [
  "Botwell","Brunel","Charville","Heathrow Villages","Hayes Town",
  "Hillingdon East","Manor","Northwood","Pinkwell","Ruislip",
  "Townfield","Uxbridge","West Drayton","Yiewsley",
];

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-civic mb-5">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#0F766E,#0D9488)" }}>
          <Icon size={14} className="text-white" />
        </div>
        <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const ok = toast.type === "success";
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-[13px] font-semibold border ${
      ok ? "bg-white border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"
    }`}>
      {ok ? <CheckCircle2 size={15} className="text-emerald-500" /> : <AlertTriangle size={15} />}
      {toast.msg}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-[14px] text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition dark:bg-[#1E293B] dark:border-[#334155] dark:text-[#F1F5F9]";

/* ── Profile section ───────────────────────────────────────────── */
function ProfileSection({ user, onSaved, showToast }) {
  const [name, setName]     = useState(user.name || "");
  const [email, setEmail]   = useState(user.email || "");
  const [ward, setWard]     = useState(user.ward || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.updateProfile(name, email, ward || null);
      onSaved(updated);
      showToast("success", "Profile updated.");
    } catch (e) {
      showToast("error", e.message.includes("email_exists") ? "That email is already in use." : e.message);
    } finally { setSaving(false); }
  };

  const dirty = name !== user.name || email !== user.email || (ward || "") !== (user.ward || "");

  return (
    <SectionCard title="Profile" icon={User}>
      <Field label="Full name">
        <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Email address">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Ward (optional)">
        <select value={ward} onChange={e => setWard(e.target.value)} className={inputCls}>
          <option value="">No preference</option>
          {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </Field>
      <button
        onClick={save}
        disabled={saving || !dirty}
        className="btn-primary text-[13px]"
      >
        <Save size={13} />
        {saving ? "Saving…" : "Save changes"}
      </button>
    </SectionCard>
  );
}

/* ── Password section ──────────────────────────────────────────── */
function PasswordSection({ showToast }) {
  const [current, setCurrent] = useState("");
  const [next, setNext]       = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving]   = useState(false);

  const save = async () => {
    if (next !== confirm) { showToast("error", "New passwords don't match."); return; }
    if (next.length < 8)  { showToast("error", "Password must be at least 8 characters."); return; }
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setCurrent(""); setNext(""); setConfirm("");
      showToast("success", "Password changed.");
    } catch (e) {
      showToast("error", e.message.includes("invalid_credentials") ? "Current password is incorrect." : e.message);
    } finally { setSaving(false); }
  };

  return (
    <SectionCard title="Security" icon={Lock}>
      <Field label="Current password">
        <input type="password" value={current} onChange={e => setCurrent(e.target.value)} className={inputCls} autoComplete="current-password" />
      </Field>
      <Field label="New password">
        <input type="password" value={next} onChange={e => setNext(e.target.value)} className={inputCls} autoComplete="new-password" />
        <p className="text-[11px] text-gray-400 mt-1.5">Min. 8 characters, one uppercase, one number.</p>
      </Field>
      <Field label="Confirm new password">
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} autoComplete="new-password" />
      </Field>
      <button onClick={save} disabled={saving || !current || !next || !confirm} className="btn-primary text-[13px]">
        <Lock size={13} />
        {saving ? "Saving…" : "Change password"}
      </button>
    </SectionCard>
  );
}

/* ── Appearance section ────────────────────────────────────────── */
function AppearanceSection() {
  const { theme, toggle } = useTheme();

  const modes = [
    { id: "light", label: "Light",  icon: Sun },
    { id: "dark",  label: "Dark",   icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];

  const handleSelect = (id) => {
    if (id === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      localStorage.removeItem("hillingone_theme");
      document.documentElement.classList.toggle("dark", prefersDark);
    } else if (id === "dark") {
      if (theme !== "dark") toggle();
    } else {
      if (theme !== "light") toggle();
    }
  };

  const active = theme;

  return (
    <SectionCard title="Appearance" icon={Moon}>
      <p className="text-[13px] text-gray-500 mb-4">Choose how HillingOne looks to you.</p>
      <div className="grid grid-cols-3 gap-3">
        {modes.map(({ id, label, icon: Icon }) => {
          const isActive = id === "system" ? false : active === id;
          return (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                isActive
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-gray-200 hover:border-gray-300 text-gray-500"
              }`}
            >
              <Icon size={20} />
              <span className="text-[12px] font-semibold">{label}</span>
              {isActive && <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wide">Active</span>}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ── Notifications section ─────────────────────────────────────── */
function NotificationsSection() {
  const load = (k, d) => {
    try { return JSON.parse(localStorage.getItem(`hillingone_notif_${k}`) ?? String(d)); } catch { return d; }
  };

  const [emailBooking,   setEmailBooking]   = useState(() => load("email_booking",   true));
  const [emailReminders, setEmailReminders] = useState(() => load("email_reminders", true));
  const [emailMarketing, setEmailMarketing] = useState(() => load("email_marketing", false));

  const save = (key, val, setter) => {
    setter(val);
    localStorage.setItem(`hillingone_notif_${key}`, String(val));
  };

  const Toggle = ({ value, onChange, label, description }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-[13px] font-semibold text-gray-800">{label}</p>
        {description && <p className="text-[11px] text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${value ? "bg-teal-500" : "bg-gray-200"}`}
        style={{ width: 40, height: 22 }}
        role="switch"
        aria-checked={value}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform"
          style={{ width: 18, height: 18, transform: value ? "translateX(18px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );

  return (
    <SectionCard title="Notifications" icon={Bell}>
      <Toggle
        value={emailBooking}
        onChange={v => save("email_booking", v, setEmailBooking)}
        label="Booking confirmations"
        description="Email when a booking is confirmed or cancelled"
      />
      <Toggle
        value={emailReminders}
        onChange={v => save("email_reminders", v, setEmailReminders)}
        label="Booking reminders"
        description="24-hour reminder before your booking"
      />
      <Toggle
        value={emailMarketing}
        onChange={v => save("email_marketing", v, setEmailMarketing)}
        label="News & updates"
        description="New features and council announcements"
      />
    </SectionCard>
  );
}

/* ── Main view ─────────────────────────────────────────────────── */
export default function SettingsView() {
  const { user, login }  = useAuth();
  const navigate         = useNavigate();
  const [toast, setToast] = useState(null);

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSaved = (updated) => {
    const token = localStorage.getItem("hillingone_token");
    login(token, updated);
  };

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 fade-in-up">
      <Toast toast={toast} />

      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-teal-600 mb-7 transition font-medium">
        <ArrowLeft size={14} /> Back
      </button>

      <div className="mb-8">
        <h1 className="text-[28px] font-black text-gray-900 tracking-tight">Settings</h1>
        <p className="text-[14px] text-gray-400 mt-1">Manage your account, appearance and preferences.</p>
      </div>

      <ProfileSection user={user} onSaved={handleSaved} showToast={showToast} />
      <PasswordSection showToast={showToast} />
      <AppearanceSection />
      <NotificationsSection />
    </div>
  );
}
