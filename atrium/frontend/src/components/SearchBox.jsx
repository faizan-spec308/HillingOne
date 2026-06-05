import { useState, useRef, useEffect } from "react";
import { Search, Mic, Globe, Sparkles, ArrowRight, ChevronDown, MapPin, Users, Clock } from "lucide-react";

const EXAMPLES = [
  "Hall for 80 people in Hayes next Saturday, parking & kitchen",
  "Meeting room for 12 in Uxbridge tomorrow afternoon",
  "Wheelchair-accessible sports hall Saturday morning",
];

const LANGUAGES = [
  { code: "en-GB", label: "English", flag: "🇬🇧" },
  { code: "ur",    label: "اردو",     flag: "🇵🇰" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ",   flag: "🇮🇳" },
  { code: "pl-PL", label: "Polski",   flag: "🇵🇱" },
  { code: "ar",    label: "العربية",  flag: "🇸🇦" },
  { code: "so",    label: "Soomaali", flag: "🇸🇴" },
  { code: "hi-IN", label: "हिन्दी",   flag: "🇮🇳" },
];

const STATS = [
  { icon: MapPin,  value: "50+",  label: "Spaces available" },
  { icon: Users,   value: "8",    label: "Languages supported" },
  { icon: Sparkles,value: "AI",   label: "Intelligent search" },
  { icon: Clock,   value: "24/7", label: "Always available" },
];

export default function SearchBox({ onSearch, loading }) {
  const [query, setQuery]       = useState("");
  const [listening, setListening] = useState(false);
  const [lang, setLang]         = useState("en-GB");
  const [langOpen, setLangOpen] = useState(false);
  const [focused, setFocused]   = useState(false);
  const recRef    = useRef(null);
  const langRef   = useRef(null);
  const textareaRef = useRef(null);

  const submit = (text) => {
    const q = (text || query).trim();
    if (!q || loading) return;
    onSearch(q);
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input isn't supported in this browser."); return; }
    const rec = new SR();
    rec.lang = lang;
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = () => setListening(false);
    rec.onresult = (e) => { const t = e.results[0][0].transcript; setQuery(t); setListening(false); };
    recRef.current = rec;
    rec.start();
  };

  useEffect(() => {
    const h = (e) => { if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selectedLang = LANGUAGES.find((l) => l.code === lang);

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b border-gray-100" style={{
        background: "linear-gradient(160deg, #f5f3ff 0%, #faf9ff 50%, #ffffff 100%)",
      }}>
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(#1a3f6f 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

        <div className="relative max-w-3xl mx-auto px-6 pt-16 pb-12">

          {/* Badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 px-4 py-2 bg-hillingdon-navy text-white rounded-full text-[12px] font-semibold tracking-wide shadow-md">
              <Sparkles size={11} className="opacity-90" />
              Powered by AI · Searches all 50+ council booking systems
            </span>
          </div>

          {/* Heading */}
          <div className="text-center mb-10">
            <h1 className="font-display text-[44px] md:text-[56px] font-black text-gray-900 leading-[1.05] tracking-tight mb-5">
              Book any council space
              <br />
              <span style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                in plain English.
              </span>
            </h1>
            <p className="text-gray-500 text-[17px] max-w-xl mx-auto leading-relaxed">
              Describe what you need. Atrium finds the best match from every facility across the London Borough of Hillingdon — instantly.
            </p>
          </div>

          {/* Search card */}
          <div
            className="bg-white rounded-2xl overflow-hidden transition-all duration-300"
            style={{
              border: focused ? "1.5px solid #1a3f6f" : "1.5px solid #e5e7eb",
              boxShadow: focused
                ? "0 0 0 4px rgba(26,63,111,0.08), 0 8px 32px rgba(26,63,111,0.12)"
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
                placeholder="e.g. a hall for 80 people in Hayes next Saturday afternoon, with parking and a kitchen…"
                rows={3}
                className="w-full text-[15px] text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none leading-relaxed font-normal"
              />
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/60 gap-3">
              <div className="flex items-center gap-2">

                {/* Voice */}
                <button
                  onClick={startVoice}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border transition-all ${
                    listening
                      ? "bg-red-50 border-red-200 text-red-600 pulse-subtle"
                      : "bg-white border-gray-200 text-gray-600 hover:border-hillingdon-navy hover:text-hillingdon-navy hover:bg-hillingdon-navy-tint"
                  }`}
                >
                  <Mic size={13} />
                  {listening ? "Listening…" : "Voice"}
                </button>

                {/* Language */}
                <div className="relative" ref={langRef}>
                  <button
                    onClick={() => setLangOpen((o) => !o)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium border bg-white border-gray-200 text-gray-600 hover:border-hillingdon-navy hover:text-hillingdon-navy hover:bg-hillingdon-navy-tint transition"
                  >
                    <Globe size={13} />
                    {selectedLang?.flag} {selectedLang?.label}
                    <ChevronDown size={11} className={`transition-transform ${langOpen ? "rotate-180" : ""}`} />
                  </button>
                  {langOpen && (
                    <div className="absolute top-full left-0 mt-1.5 w-48 bg-white border border-gray-200 rounded-xl overflow-hidden py-1 z-20 shadow-civic-md">
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => { setLang(l.code); setLangOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 transition ${
                            l.code === lang ? "bg-hillingdon-navy-tint text-hillingdon-navy font-semibold" : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <span>{l.flag}</span> {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={() => submit()}
                disabled={loading || !query.trim()}
                className="btn-primary"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" style={{ animation: "spin 0.7s linear infinite" }} />
                    Searching…
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    Search spaces
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Example queries */}
          <div className="flex flex-wrap gap-2 justify-center mt-5">
            <span className="text-[12px] text-gray-400 font-medium self-center mr-1">Try:</span>
            {EXAMPLES.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); submit(q); }}
                className="px-3.5 py-1.5 text-[12.5px] bg-white border border-gray-200 rounded-full text-gray-600 hover:border-hillingdon-navy hover:text-hillingdon-navy hover:bg-hillingdon-navy-tint transition shadow-sm font-medium"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats strip ───────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="grid grid-cols-4 divide-x divide-gray-100">
            {STATS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="text-center px-4">
                <div className="text-[19px] font-display font-black text-hillingdon-navy leading-tight">{value}</div>
                <div className="text-[11px] text-gray-400 font-medium mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
