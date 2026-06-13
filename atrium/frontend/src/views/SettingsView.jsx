import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Lock, Bell, Moon, Sun, CheckCircle2, AlertTriangle, Save } from "lucide-react";
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
    <div className="rounded-2xl overflow-hidden shadow-civic mb-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="px-6 py-4 flex items-center gap-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--brand)" }}>
          <Icon size={14} className="text-white" />
        </div>
        <h2 className="text-[15px] font-bold" style={{ color: "var(--text-1)" }}>{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

/* Feedback shown inline within a section, right by its action button —
   so it's always visible without scrolling back to the top. */
function InlineAlert({ msg }) {
  if (!msg) return null;
  const ok = msg.type === "success";
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4 text-[13px] font-medium"
      style={{
        background: ok ? "var(--success-bg)" : "var(--danger-bg)",
        color: ok ? "var(--success-fg)" : "var(--danger-fg)",
      }}
      role={ok ? "status" : "alert"}
    >
      {ok
        ? <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" />
        : <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />}
      <span>{msg.text}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-2)" }}>{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-xl px-3.5 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition";

/* ── Profile section ───────────────────────────────────────────── */
function ProfileSection({ user, onSaved }) {
  const [name, setName]     = useState(user.name || "");
  const [email, setEmail]   = useState(user.email || "");
  const [ward, setWard]     = useState(user.ward || "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api.updateProfile(name, email, ward || null);
      onSaved(updated);
      setMsg({ type: "success", text: "Profile updated." });
    } catch (e) {
      setMsg({ type: "error", text: e.message.includes("email_exists") ? "That email is already in use." : e.message });
    } finally { setSaving(false); }
  };

  const dirty = name !== user.name || email !== user.email || (ward || "") !== (user.ward || "");
  const inp = { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-1)" };

  return (
    <SectionCard title="Profile" icon={User}>
      <Field label="Full name">
        <input value={name} onChange={e => setName(e.target.value)} className={inputCls} style={inp} />
      </Field>
      <Field label="Email address">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} style={inp} />
      </Field>
      <Field label="Ward (optional)">
        <select value={ward} onChange={e => setWard(e.target.value)} className={inputCls} style={inp}>
          <option value="">No preference</option>
          {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </Field>
      <InlineAlert msg={msg} />
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
function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const save = async (e) => {
    e?.preventDefault();

    if (saving) return;

    setMsg(null);

    if (!current || !next || !confirm) {
      setMsg({
        type: "error",
        text: "Please fill in all fields.",
      });
      return;
    }

    if (next !== confirm) {
      setMsg({
        type: "error",
        text: "New passwords don't match.",
      });
      return;
    }

    if (current === next) {
      setMsg({
        type: "error",
        text: "New password must be different from your current password.",
      });
      return;
    }

    const strongPassword =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

    if (!strongPassword.test(next)) {
      setMsg({
        type: "error",
        text:
          "Password must be at least 8 characters and include an uppercase letter and a number.",
      });
      return;
    }

    setSaving(true);

    try {
      await api.changePassword(current, next);

      setCurrent("");
      setNext("");
      setConfirm("");

      setMsg({
        type: "success",
        text: "Password changed successfully.",
      });
    } catch (e) {
      console.error("Change password error:", e);

      const errorMessage =
        e?.message?.toLowerCase() || "";

      if (
        errorMessage.includes("invalid_credentials") ||
        errorMessage.includes("incorrect") ||
        errorMessage.includes("wrong password")
      ) {
        setMsg({
          type: "error",
          text: "Current password is incorrect.",
        });
      } else {
        setMsg({
          type: "error",
          text:
            "Unable to change password right now. Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const inp = {
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text-1)",
  };

  return (
    <SectionCard title="Security" icon={Lock}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Current password">
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputCls}
            style={inp}
            autoComplete="current-password"
          />
        </Field>

        <Field label="New password">
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputCls}
            style={inp}
            autoComplete="new-password"
          />

          <p
            className="text-[11px] mt-1.5"
            style={{ color: "var(--text-3)" }}
          >
            Minimum 8 characters, one uppercase letter, and one number.
          </p>
        </Field>

        <Field label="Confirm new password">
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
            style={inp}
            autoComplete="new-password"
          />
        </Field>

        <InlineAlert msg={msg} />

        <button
          type="submit"
          disabled={
            saving ||
            !current ||
            !next ||
            !confirm
          }
          className="btn-primary text-[13px]"
        >
          <Lock size={13} />

          {saving ? "Saving..." : "Change password"}
        </button>
      </form>
    </SectionCard>
  );
}

/* ── Appearance section ────────────────────────────────────────── */
function AppearanceSection() {
  const { theme, toggle } = useTheme();

  const modes = [
    { id: "light", label: "Light", icon: Sun,  desc: "Always light" },
    { id: "dark",  label: "Dark",  icon: Moon, desc: "Always dark"  },
  ];

  const handleSelect = (id) => {
    if (id === "dark"  && theme !== "dark")  toggle();
    if (id === "light" && theme !== "light") toggle();
  };

  return (
    <SectionCard title="Appearance" icon={Moon}>
      <p className="text-[13px] mb-4" style={{ color: "var(--text-2)" }}>Choose how HillingOne looks to you.</p>
      <div className="grid grid-cols-2 gap-3">
        {modes.map(({ id, label, icon: Icon, desc }) => {
          const isActive = theme === id;
          return (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className={`flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 transition-all ${
                isActive
                  ? "border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:border-teal-500 dark:text-teal-400"
                  : "border-gray-200 hover:border-gray-300 text-gray-500"
              }`}
            >
              <Icon size={22} />
              <div className="text-center">
                <span className="block text-[13px] font-bold">{label}</span>
                <span className="block text-[11px] opacity-60 mt-0.5">{desc}</span>
              </div>
              {isActive && (
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/50 rounded-full uppercase tracking-wide">
                  Active
                </span>
              )}
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
    <div className="flex items-center justify-between py-3 last:border-0"
      style={{ borderBottom: "1px solid var(--border)" }}>
      <div>
        <p className="text-[13px] font-semibold" style={{ color: "var(--text-1)" }}>{label}</p>
        {description && <p className="text-[11px] mt-0.5" style={{ color: "var(--text-3)" }}>{description}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative rounded-full transition-colors flex-shrink-0 ${value ? "bg-teal-500" : ""}`}
        style={{ width: 40, height: 22, background: value ? "var(--brand)" : "var(--border-strong)" }}
        role="switch"
        aria-checked={value}
      >
        <span
          className="absolute top-0.5 left-0.5 bg-white rounded-full shadow transition-transform"
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

  const handleSaved = (updated) => {
    const token = localStorage.getItem("hillingone_token");
    login(token, updated);
  };

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 fade-in-up">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-[13px] hover:text-teal-600 mb-7 transition font-medium" style={{ color: "var(--text-3)" }}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="mb-8">
        <h1 className="text-[28px] font-black tracking-tight" style={{ color: "var(--text-1)" }}>Settings</h1>
        <p className="text-[14px] mt-1" style={{ color: "var(--text-3)" }}>Manage your account, appearance and preferences.</p>
      </div>

      {/* Profile hero card */}
      {user && (() => {
        const initials = user.name
          ? user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
          : "?";
        const t1   = "var(--text-1)";
        const t2   = "var(--text-2)";
        const isStaff = user.role === "staff" || user.role === "councillor";
        return (
          <div className="rounded-2xl px-6 py-5 mb-6 flex items-center gap-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-[22px] font-black flex-shrink-0"
              style={{ background: isStaff ? "var(--brand)" : "var(--success)" }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-black truncate" style={{ color: t1 }}>{user.name}</p>
              <p className="text-[13px] truncate" style={{ color: t2 }}>{user.email}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="badge badge-brand capitalize">
                  {user.role}
                </span>
                {user.ward && (
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full"
                    style={{ background: "var(--surface-2)", color: t2 }}>
                    {user.ward}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <ProfileSection user={user} onSaved={handleSaved} />
      <PasswordSection />
      <AppearanceSection />
      <NotificationsSection />
    </div>
  );
}
