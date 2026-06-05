import { useState } from "react";
import { Eye, EyeOff, ArrowRight, ShieldCheck, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function AuthPage() {
  const { login } = useAuth();
  const [mode, setMode]       = useState("login"); // "login" | "register"
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [showPw, setShowPw]   = useState(false);

  const [form, setForm] = useState({ name: "", email: "", password: "", ward: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = mode === "login"
        ? await api.login(form.email, form.password)
        : await api.register(form.name, form.email, form.password, form.ward);
      login(res.token, res.user);
    } catch (err) {
      setError(err.message.replace(/^\d+: /, ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* Left panel — branding */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #0F2A50 0%, #1B4F8C 60%, #2563EB 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #60A5FA, transparent)" }} />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10" style={{ background: "radial-gradient(circle, #34D399, transparent)" }} />

        {/* Logo */}
        <div className="flex items-center gap-3 z-10">
          <div className="w-10 h-10 bg-white/15 rounded-2xl flex items-center justify-center backdrop-blur-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <p className="text-white/60 text-[11px] font-medium uppercase tracking-widest">Hillingdon Council</p>
            <p className="text-white text-[20px] font-black tracking-tight">Atrium</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="z-10">
          <h1 className="text-[40px] font-black text-white leading-tight mb-4">
            Book council<br />spaces with<br />
            <span className="text-blue-300">confidence.</span>
          </h1>
          <p className="text-white/70 text-[16px] leading-relaxed mb-8">
            AI-powered matching across every council facility in the London Borough of Hillingdon.
          </p>

          {/* Trust signals */}
          <div className="space-y-3">
            {[
              "Over 40 facilities across the borough",
              "Instant booking confirmation",
              "Full refund on cancellation",
              "Reminders sent automatically",
            ].map((t) => (
              <div key={t} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-400/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-white/80 text-[14px]">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom badge */}
        <div className="flex items-center gap-2 z-10">
          <ShieldCheck size={14} className="text-white/40" />
          <span className="text-white/40 text-[12px]">Official digital service · London Borough of Hillingdon</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-hillingdon-navy rounded-xl flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <span className="text-[18px] font-black text-gray-900">Atrium</span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">

            {/* Toggle */}
            <div className="flex bg-gray-100 rounded-2xl p-1 mb-8">
              {["login", "register"].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); }}
                  className={`flex-1 py-2.5 text-[14px] font-semibold rounded-xl transition-all ${
                    mode === m ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {m === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>

            <h2 className="text-[22px] font-black text-gray-900 mb-1">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-[14px] text-gray-500 mb-7">
              {mode === "login"
                ? "Sign in to manage your council bookings."
                : "Join thousands of Hillingdon residents booking council spaces."}
            </p>

            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && (
                <Field label="Full name" type="text" value={form.name} onChange={set("name")} placeholder="e.g. Sarah Johnson" required />
              )}

              <Field label="Email address" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" required />

              <div>
                <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                    required
                    minLength={mode === "register" ? 8 : 1}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hillingdon-navy/20 focus:border-hillingdon-navy transition"
                  />
                  <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <Field label="Ward (optional)" type="text" value={form.ward} onChange={set("ward")} placeholder="e.g. Hayes Town" />
              )}

              {error && (
                <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700 font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-hillingdon-navy hover:bg-blue-900 text-white text-[15px] font-bold rounded-2xl transition-all shadow-sm hover:shadow-md mt-2"
              >
                {loading
                  ? <><Loader2 size={18} className="animate-spin" /> {mode === "login" ? "Signing in…" : "Creating account…"}</>
                  : <>{mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={18} /></>
                }
              </button>
            </form>

            <p className="text-center text-[13px] text-gray-400 mt-6">
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
                className="text-hillingdon-navy font-semibold hover:underline">
                {mode === "login" ? "Create one" : "Sign in"}
              </button>
            </p>
          </div>

          <p className="text-center text-[12px] text-gray-400 mt-6">
            Staff? Contact your administrator to get access.
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, required }) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[14px] text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-hillingdon-navy/20 focus:border-hillingdon-navy transition"
      />
    </div>
  );
}
