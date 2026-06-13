import { useState, useRef } from "react";
import { Search, Mic, Sparkles, ArrowRight, MapPin, Users, Clock } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

export default function SearchBox({ onSearch, loading, onBrowse }) {
  const { t, lang } = useLanguage();

  const [query,     setQuery]     = useState("");
  const [listening, setListening] = useState(false);
  const [focused,   setFocused]   = useState(false);
  const [voiceError, setVoiceError] = useState(null);

  const showVoiceError = (text) => {
    setVoiceError(text);
    setTimeout(() => setVoiceError(null), 5000);
  };

  const recRef      = useRef(null);
  const textareaRef = useRef(null);

  const EXAMPLES = [
    "Hall for 80 people in Hayes next Saturday, parking & kitchen",
    "Meeting room for 12 in Uxbridge tomorrow afternoon",
    "Wheelchair-accessible sports hall Saturday morning",
  ];

  const STATS = [
    { icon: MapPin,   value: "50+", labelKey: "stat_spaces" },
    { icon: Users,    value: "4",   labelKey: "stat_languages" },
    { icon: Sparkles, value: "AI",  labelKey: "stat_ai" },
    { icon: Clock,    value: "24/7",labelKey: "stat_hours" },
  ];

  const submit = (text) => {
    const q = (text || query).trim();
    if (!q || loading) return;
    onSearch(q);
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showVoiceError("Voice input isn't supported in this browser."); return; }
    const rec = new SR();
    rec.lang     = lang === "ur" ? "ur" : lang === "ar" ? "ar" : lang === "pl" ? "pl-PL" : "en-GB";
    rec.onstart  = () => { setVoiceError(null); setListening(true); };
    rec.onend    = () => setListening(false);
    rec.onerror  = (e) => {
      setListening(false);
      if (e.error === "not-allowed") showVoiceError("Microphone permission denied. Allow mic access in your browser settings.");
      else if (e.error === "no-speech") showVoiceError("No speech detected. Please try again.");
      else if (e.error === "network") showVoiceError("Voice input requires an internet connection.");
    };
    rec.onresult = (e) => { setQuery(e.results[0][0].transcript); setListening(false); };
    recRef.current = rec;
    rec.start();
  };

  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(180deg, var(--bg) 0%, var(--bg-card) 100%)",
        }}
      >
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(var(--brand) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
        />

        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-12">

          {/* Badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-hillingdon-navy text-white rounded-full text-[12px] font-semibold tracking-wide shadow-md">
              <Sparkles size={11} className="opacity-90" />
              {t("search_badge")}
            </span>
          </div>

          {/* Heading */}
          <div className="text-center mb-10">
            <h1 className="font-display text-[44px] md:text-[56px] font-black leading-[1.05] tracking-tight mb-5" style={{ color: "var(--text-1)" }}>
              {t("search_heading")}
              <br />
              <span style={{ color: "var(--brand)" }}>
                {t("search_heading_accent")}
              </span>
            </h1>
            <p className="text-[17px] max-w-xl mx-auto leading-relaxed" style={{ color: "var(--text-2)" }}>
              {t("search_sub")}
            </p>
          </div>

          {/* Search card */}
          <div
            className="rounded-2xl overflow-hidden transition-all duration-300"
            style={{
              background: "var(--bg-card)",
              border: `1.5px solid ${focused ? "var(--brand)" : "var(--border)"}`,
              boxShadow: focused ? "0 0 0 4px var(--brand-ring), var(--shadow-lg)" : "var(--shadow-md)",
            }}
          >
            {/* Textarea */}
            <div className="px-5 pt-5 pb-3">
              <textarea
                ref={textareaRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
                }}
                placeholder={t("search_ph")}
                rows={3}
                autoFocus
                aria-label={t("search_ph")}
                className="search-textarea w-full text-[15px] resize-none focus:outline-none leading-relaxed font-normal"
                style={{ background: "transparent", color: "var(--text-1)", caretColor: "var(--brand)" }}
              />
            </div>

            {/* Toolbar — same surface as the card; a hairline divider does
                the separation, so dark mode isn't two competing shades */}
            <div
              className="flex items-center justify-between px-4 py-3 gap-3"
              style={{ borderTop: "1px solid var(--border)", background: "transparent" }}
            >
              <div className="flex items-center gap-2">

                {/* Voice */}
                <button
                  onClick={startVoice}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all"
                  style={listening
                    ? { background: "var(--danger-bg)", borderColor: "var(--danger)", color: "var(--danger)" }
                    : { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-2)" }
                  }
                >
                  <Mic size={13} />
                  {listening ? t("search_listening") : t("search_voice")}
                </button>

                {voiceError && (
                  <span className="text-[12px] leading-tight" style={{ color: "var(--danger)" }} role="alert">
                    {voiceError}
                  </span>
                )}

              </div>

              {/* Submit */}
              <button
                onClick={() => submit()}
                disabled={loading || !query.trim()}
                className="btn-primary"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{ animation: "spin 0.7s linear infinite" }} />
                    {t("search_searching")}
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    {t("search_btn")}
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Example queries */}
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            <span className="text-[12px] font-medium self-center mr-1" style={{ color: "var(--text-3)" }}>{t("search_try")}</span>
            {EXAMPLES.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); submit(q); }}
                className="px-3.5 py-1.5 text-[12.5px] rounded-full transition shadow-sm font-medium hover:border-hillingdon-navy hover:text-hillingdon-navy"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-2)" }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Manual browse fallback — quiet, directly under the search */}
          {onBrowse && (
            <div className="text-center mt-6">
              <button onClick={onBrowse} className="text-[13px] font-medium transition" style={{ color: "var(--text-2)" }}>
                Prefer manual search?{" "}
                <span className="font-semibold hover:underline" style={{ color: "var(--brand)" }}>Browse all spaces →</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="grid grid-cols-4" style={{ borderLeft: "1px solid var(--border)" }}>
            {STATS.map(({ icon: Icon, value, labelKey }) => (
              <div key={labelKey} className="text-center px-4" style={{ borderRight: "1px solid var(--border)" }}>
                <div className="text-[19px] font-display font-black leading-tight" style={{ color: "var(--brand)" }}>{value}</div>
                <div className="text-[11px] font-medium mt-0.5" style={{ color: "var(--text-3)" }}>{t(labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
