import { useState, useRef } from "react";
import { Search, Mic, Sparkles, ArrowRight, MapPin, Users, Clock } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";

export default function SearchBox({ onSearch, loading }) {
  const { t, lang } = useLanguage();
  const { isDark } = useTheme();

  const [query,     setQuery]     = useState("");
  const [listening, setListening] = useState(false);
  const [focused,   setFocused]   = useState(false);

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
    if (!SR) { alert("Voice input isn't supported in this browser."); return; }
    const rec = new SR();
    rec.lang     = lang === "ur" ? "ur" : lang === "ar" ? "ar" : lang === "pl" ? "pl-PL" : "en-GB";
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = (e) => {
      setListening(false);
      if (e.error === "not-allowed") alert("Microphone permission was denied. Please allow microphone access in your browser settings.");
      else if (e.error === "no-speech") alert("No speech detected. Please try again.");
      else if (e.error === "network") alert("Voice input requires an internet connection.");
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
        style={{ borderBottom: `1px solid ${isDark ? "#21262D" : "#F3F4F6"}`, background: isDark
          ? "linear-gradient(180deg, #0A0F16 0%, #0E1117 100%)"
          : "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)" }}
      >
        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(#0D9488 1px, transparent 1px)", backgroundSize: "24px 24px" }}
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
            <h1 className="font-display text-[44px] md:text-[56px] font-black leading-[1.05] tracking-tight mb-5" style={{ color: isDark ? "#E6EDF3" : "#111827" }}>
              {t("search_heading")}
              <br />
              <span style={{ color: "#0D9488" }}>
                {t("search_heading_accent")}
              </span>
            </h1>
            <p className="text-[17px] max-w-xl mx-auto leading-relaxed" style={{ color: isDark ? "#8B949E" : "#6B7280" }}>
              {t("search_sub")}
            </p>
          </div>

          {/* Search card */}
          <div
            className="rounded-2xl overflow-hidden transition-all duration-300"
            style={{
              background: isDark ? "#161B22" : "#ffffff",
              border: focused
                ? "1.5px solid #0D9488"
                : isDark ? "1.5px solid #30363D" : "1.5px solid #e5e7eb",
              boxShadow: focused
                ? isDark
                  ? "0 0 0 4px rgba(13,148,136,0.15), 0 8px 32px rgba(0,0,0,0.4)"
                  : "0 0 0 4px rgba(13,148,136,0.10), 0 8px 32px rgba(13,148,136,0.14)"
                : isDark
                  ? "0 0 0 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.4)"
                  : "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
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
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
                placeholder={t("search_ph")}
                rows={3}
                className="w-full text-[15px] resize-none focus:outline-none leading-relaxed font-normal"
                style={{
                  background: "transparent",
                  color: isDark ? "#E6EDF3" : "#111827",
                  caretColor: "#0D9488",
                }}
              />
            </div>

            {/* Toolbar */}
            <div
              className="flex items-center justify-between px-4 py-3 gap-3"
              style={{ borderTop: `1px solid ${isDark ? "#21262D" : "#F3F4F6"}`, background: isDark ? "rgba(255,255,255,0.02)" : "rgba(249,250,251,0.6)" }}
            >
              <div className="flex items-center gap-2">

                {/* Voice */}
                <button
                  onClick={startVoice}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all"
                  style={listening
                    ? { background: "#FEF2F2", borderColor: "#FECACA", color: "#DC2626" }
                    : { background: isDark ? "#21262D" : "#ffffff", borderColor: isDark ? "#30363D" : "#E5E7EB", color: isDark ? "#8B949E" : "#4B5563" }
                  }
                >
                  <Mic size={13} />
                  {listening ? t("search_listening") : t("search_voice")}
                </button>

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
            <span className="text-[12px] font-medium self-center mr-1" style={{ color: isDark ? "#484F58" : "#9CA3AF" }}>{t("search_try")}</span>
            {EXAMPLES.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); submit(q); }}
                className="px-3.5 py-1.5 text-[12.5px] rounded-full transition shadow-sm font-medium hover:border-hillingdon-navy hover:text-hillingdon-navy"
                style={{
                  background: isDark ? "#1C2128" : "#ffffff",
                  border: `1px solid ${isDark ? "#30363D" : "#e5e7eb"}`,
                  color: isDark ? "#8B949E" : "#4b5563",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${isDark ? "#21262D" : "#F3F4F6"}`, background: isDark ? "#161B22" : "#ffffff" }}>
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="grid grid-cols-4" style={{ borderLeft: `1px solid ${isDark ? "#21262D" : "#F3F4F6"}` }}>
            {STATS.map(({ icon: Icon, value, labelKey }) => (
              <div key={labelKey} className="text-center px-4" style={{ borderRight: `1px solid ${isDark ? "#21262D" : "#F3F4F6"}` }}>
                <div className="text-[19px] font-display font-black leading-tight" style={{ color: isDark ? "#2DD4BF" : "#0D9488" }}>{value}</div>
                <div className="text-[11px] font-medium mt-0.5" style={{ color: isDark ? "#8B949E" : "#9CA3AF" }}>{t(labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
