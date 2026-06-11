import { useState } from "react";
import { Eye, EyeOff, ArrowRight, ShieldCheck, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import { api } from "../api/client";

export default function AuthPage({ initialMode = "login" }) {
  const { login } = useAuth();
  const { t, lang, setLang, languages } = useLanguage();
  const { isDark } = useTheme();

  // Read reset token from URL if present
  const urlToken = new URLSearchParams(window.location.search).get("token");
  const startMode = urlToken ? "reset" : initialMode;

  const [mode, setMode]         = useState(startMode);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [success, setSuccess]   = useState(null);
  const [showPw, setShowPw]     = useState(false);
  const [form, setForm]         = useState({ name: "", email: "", password: "", ward: "", newPassword: "" });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const t1  = isDark ? "#E6EDF3" : "#111827";
  const t2  = isDark ? "#8B949E" : "#6B7280";
  const t3  = isDark ? "#484F58" : "#9CA3AF";
  const bdr = isDark ? "#30363D" : "#E5E7EB";
  const bdrLight = isDark ? "#21262D" : "#F3F4F6";
  const card = isDark ? "#161B22" : "#ffffff";
  const inp  = {
    background: isDark ? "#0E1117" : "#ffffff",
    border: `1px solid ${isDark ? "#30363D" : "#D1D5DB"}`,
    color: t1,
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === "login") {
        const res = await api.login(form.email, form.password);
        login(res.token, res.user);
      } else if (mode === "register") {
        const res = await api.register(form.name, form.email, form.password, form.ward);
        login(res.token, res.user);
      } else if (mode === "forgot") {
        await api.forgotPassword(form.email);
        setSuccess("If that email is registered, a reset link has been sent. Check your inbox.");
      } else if (mode === "reset") {
        await api.resetPassword(urlToken, form.newPassword);
        setSuccess("Password updated. You can now sign in.");
        setMode("login");
      }
    } catch (err) {
      setError(err.message.replace(/^\d+: /, ""));
    } finally {
      setLoading(false);
    }
  };

  const trustPoints = [
    t("auth_trust_1"),
    t("auth_trust_2"),
    t("auth_trust_3"),
    t("auth_trust_4"),
  ];

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(160deg, #042F2E 0%, #0F766E 55%, #0D9488 100%)" }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #2DD4BF, transparent)" }} />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #34D399, transparent)" }} />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full opacity-5"
          style={{ background: "radial-gradient(circle, #F0FDFA, transparent)" }} />

        {/* Logo + language switcher */}
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <p className="text-white/60 text-[11px] font-medium uppercase tracking-widest">Hillingdon Council</p>
              <p className="text-white text-[20px] font-black tracking-tight">HillingOne</p>
            </div>
          </div>

          {/* Language pills */}
          <div className="flex items-center gap-1.5">
            {Object.entries(languages).map(([code, { name }]) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`text-[12px] font-bold px-2.5 py-1 rounded-lg transition ${
                  lang === code
                    ? "bg-white/20 text-white ring-1 ring-white/40"
                    : "text-white/50 hover:text-white/80"
                }`}
                title={name}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Hero text */}
        <div className="z-10">
          <h1 className="text-[40px] font-black text-white leading-tight mb-4">
            {t("auth_hero").split("confidence.")[0]}
            <span className="text-teal-200">
              {t("auth_hero").includes("confidence.") ? "confidence." :
               t("auth_hero").includes("بثقة.") ? "بثقة." :
               t("auth_hero").includes("pewnością.") ? "pewnością." :
               ""}
            </span>
          </h1>
          <p className="text-white/70 text-[16px] leading-relaxed mb-8">
            {t("auth_hero_sub")}
          </p>
          <div className="space-y-3">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-emerald-400/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-white/80 text-[14px]">{point}</span>
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

      {/* ── Right panel — form ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ background: isDark ? "#0E1117" : "#F9FAFB" }}>
        <div className="w-full max-w-md">

          {/* Mobile logo + language */}
          <div className="flex items-center justify-between mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0F766E, #0D9488)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <span className="text-[18px] font-black" style={{ color: t1 }}>HillingOne</span>
            </div>
            <div className="flex items-center gap-1">
              {Object.entries(languages).map(([code, { name }]) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  title={name}
                  className="text-[11px] font-bold px-2 py-1 rounded-lg transition"
                  style={lang === code
                    ? { background: isDark ? "rgba(13,148,136,0.15)" : "#CCFBF1", color: "#0D9488", boxShadow: `0 0 0 1px #0D9488` }
                    : { color: t2 }
                  }
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Card */}
          <div className="rounded-3xl shadow-xl p-8" style={{ background: card, border: `1px solid ${bdr}` }}>

            {/* Forgot password screen */}
            {mode === "forgot" && (
              <>
                <button
                  onClick={() => { setMode("login"); setError(null); setSuccess(null); }}
                  className="flex items-center gap-1.5 text-[13px] mb-6 transition"
                  style={{ color: t2 }}
                >
                  <ArrowLeft size={14} /> Back to sign in
                </button>
                <h2 className="text-[22px] font-black mb-1" style={{ color: t1 }}>Forgot password?</h2>
                <p className="text-[14px] mb-7" style={{ color: t2 }}>Enter your email and we'll send you a reset link valid for 30 minutes.</p>
                {success ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-emerald-800">{success}</p>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-4">
                    <Field label="Email address" type="email" value={form.email} onChange={set("email")} placeholder="your@email.com" required isDark={isDark} inp={inp} t1={t1} />
                    {error && <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700 font-medium">{error}</div>}
                    <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 text-white text-[15px] font-bold rounded-2xl transition-all btn-primary">
                      {loading ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : <>Send reset link <ArrowRight size={18} /></>}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* Reset password screen */}
            {mode === "reset" && (
              <>
                <h2 className="text-[22px] font-black mb-1" style={{ color: t1 }}>Set new password</h2>
                <p className="text-[14px] mb-7" style={{ color: t2 }}>Choose a strong password with at least 8 characters, one uppercase letter, and one number.</p>
                {success ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-emerald-800">{success}</p>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-4">
                    <div>
                      <label className="block text-[13px] font-semibold mb-1.5" style={{ color: isDark ? "#C9D1D9" : "#374151" }}>New password</label>
                      <div className="relative">
                        <input
                          type={showPw ? "text" : "password"}
                          value={form.newPassword}
                          onChange={set("newPassword")}
                          placeholder="Min. 8 chars, 1 uppercase, 1 number"
                          required
                          minLength={8}
                          className="w-full rounded-xl px-4 py-3 pr-11 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                          style={{ ...inp, "::placeholder": { color: t3 } }}
                        />
                        <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 transition" style={{ color: t2 }}>
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    {error && <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700 font-medium">{error}</div>}
                    <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-3.5 text-white text-[15px] font-bold rounded-2xl transition-all btn-primary">
                      {loading ? <><Loader2 size={18} className="animate-spin" /> Updating…</> : <>Update password <ArrowRight size={18} /></>}
                    </button>
                  </form>
                )}
              </>
            )}

            {/* Login / Register screens */}
            {(mode === "login" || mode === "register") && (<>
            {/* Mode toggle */}
            <div className="flex rounded-2xl p-1 mb-8" style={{ background: isDark ? "#21262D" : "#F3F4F6" }}>
              {["login", "register"].map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                  className="flex-1 py-2.5 text-[14px] font-semibold rounded-xl transition-all"
                  style={mode === m
                    ? { background: isDark ? "#161B22" : "#ffffff", color: t1, boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }
                    : { color: t2 }
                  }
                >
                  {m === "login" ? t("auth_sign_in") : t("auth_create_account")}
                </button>
              ))}
            </div>

            <h2 className="text-[22px] font-black mb-1" style={{ color: t1 }}>
              {mode === "login" ? t("auth_welcome_back") : t("auth_create_account_title")}
            </h2>
            <p className="text-[14px] mb-7" style={{ color: t2 }}>
              {mode === "login" ? t("auth_sign_in_sub") : t("auth_register_sub")}
            </p>

            <form onSubmit={submit} className="space-y-4">
              {mode === "register" && (
                <Field label={t("auth_full_name")} type="text" value={form.name} onChange={set("name")} placeholder={t("auth_name_ph")} required isDark={isDark} inp={inp} t1={t1} />
              )}

              <Field label={t("auth_email")} type="email" value={form.email} onChange={set("email")} placeholder={t("auth_email_ph")} required isDark={isDark} inp={inp} t1={t1} />

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-semibold" style={{ color: isDark ? "#C9D1D9" : "#374151" }}>{t("auth_password")}</label>
                  {mode === "login" && (
                    <button type="button" onClick={() => { setMode("forgot"); setError(null); setSuccess(null); }} className="text-[12px] text-teal-600 hover:underline font-medium">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder={mode === "register" ? t("auth_pw_ph_register") : t("auth_pw_ph_login")}
                    required
                    minLength={mode === "register" ? 8 : 1}
                    className="w-full rounded-xl px-4 py-3 pr-11 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                    style={inp}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition"
                    style={{ color: t2 }}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <Field label={t("auth_ward")} type="text" value={form.ward} onChange={set("ward")} placeholder={t("auth_ward_ph")} isDark={isDark} inp={inp} t1={t1} />
              )}

              {error && (
                <div className="p-3.5 bg-red-50 border border-red-100 rounded-xl text-[13px] text-red-700 font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 text-white text-[15px] font-bold rounded-2xl transition-all mt-2 btn-primary"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> {mode === "login" ? t("auth_signing_in") : t("auth_creating")}</>
                ) : (
                  <>{mode === "login" ? t("auth_sign_in") : t("auth_create_account")} <ArrowRight size={18} /></>
                )}
              </button>
            </form>

            <p className="text-center text-[13px] mt-6" style={{ color: t2 }}>
              {mode === "login" ? t("auth_no_account") : t("auth_have_account")}{" "}
              <button
                onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
                className="text-teal-600 font-semibold hover:underline"
              >
                {mode === "login" ? t("auth_create_one") : t("auth_sign_in")}
              </button>
            </p>
            </>)}
          </div>

          <p className="text-center text-[12px] mt-6" style={{ color: t3 }}>{t("auth_staff_note")}</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder, required, isDark, inp, t1 }) {
  const labelColor = isDark ? "#C9D1D9" : "#374151";
  return (
    <div>
      <label className="block text-[13px] font-semibold mb-1.5" style={{ color: labelColor }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
        style={inp}
      />
    </div>
  );
}
