import { useState, useRef } from "react";
import { Search, Mic, Globe, Sparkles, ArrowRight, ChevronDown } from "lucide-react";

const EXAMPLE_QUERIES = [
  "After-school club for 20 children in Hayes with a kitchen",
  "Meeting room for 12 in Uxbridge tomorrow afternoon",
  "Sports hall Saturday morning, wheelchair accessible",
];

const LANGUAGES = [
  { code: "en-GB", label: "English" },
  { code: "ur",    label: "اردو" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ" },
  { code: "pl-PL", label: "Polski" },
  { code: "ar",    label: "العربية" },
  { code: "so",    label: "Soomaali" },
  { code: "ro-RO", label: "Română" },
  { code: "hi-IN", label: "हिन्दी" },
];

const STATS = [
  { value: "50+",  label: "Spaces & services" },
  { value: "10",   label: "Categories" },
  { value: "AI",   label: "Powered search" },
  { value: "24/7", label: "Always available" },
];

export default function SearchBox({ onSearch, loading }) {
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState("en-GB");
  const [langOpen, setLangOpen] = useState(false);
  const recognitionRef = useRef(null);

  const submit = (text) => {
    const q = (text || query).trim();
    if (!q) return;
    onSearch(q);
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input isn't supported in this browser. Please type your request."); return; }
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart  = () => setListening(true);
    rec.onend    = () => setListening(false);
    rec.onerror  = () => setListening(false);
    rec.onresult = (e) => { setQuery(e.results[0][0].transcript); setListening(false); };
    recognitionRef.current = rec;
    rec.start();
  };

  const selectedLang = LANGUAGES.find((l) => l.code === lang);

  return (
    <div>
      {/* Hero section */}
      <div
        className="border-b border-gray-200"
        style={{
          background: "linear-gradient(165deg, #EBF4FF 0%, #F0F7FF 40%, #FAFBFC 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto px-6 pt-14 pb-10">

          {/* AI pill */}
          <div className="flex justify-center mb-7">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-hillingdon-navy text-white rounded-full text-[12px] font-semibold tracking-wide shadow-sm">
              <Sparkles size={12} />
              AI-powered · One front door across every council booking system
            </span>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-[42px] md:text-[52px] font-black text-gray-900 leading-[1.05] tracking-tight">
              What do you need
              <br />
              <span className="text-hillingdon-navy">to book today?</span>
            </h1>
            <p className="mt-5 text-gray-500 text-[17px] max-w-lg mx-auto leading-relaxed">
              Describe it in plain English — or any language. Atrium searches every council system simultaneously.
            </p>
          </div>

          {/* Search card */}
          <div
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-7"
            style={{ boxShadow: "0 4px 24px rgba(27,79,140,0.10), 0 1px 4px rgba(0,0,0,0.05)" }}
          >
            {/* Textarea */}
            <div className="px-5 pt-4 pb-2">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
                placeholder="e.g. a hall for 80 people in Hayes next Saturday afternoon, with parking and a kitchen…"
                rows={3}
                aria-label="Describe what you need to book"
                className="w-full text-[15px] text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none leading-relaxed"
              />
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100 gap-3">

              {/* Left tools */}
              <div className="flex items-center gap-2">
                {/* Voice */}
                <button
                  onClick={startVoice}
                  aria-label={listening ? "Listening…" : "Voice input"}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium border transition-all ${
                    listening
                      ? "bg-red-50 border-red-200 text-red-700 pulse-subtle"
                      : "bg-white border-gray-200 text-gray-600 hover:border-hillingdon-navy hover:text-hillingdon-navy"
                  }`}
                >
                  <Mic size={14} />
                  {listening ? "Listening…" : "Voice"}
                </button>

                {/* Language picker */}
                <div className="relative">
                  <button
                    onClick={() => setLangOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={langOpen}
                    aria-label="Select language"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium border bg-white border-gray-200 text-gray-600 hover:border-hillingdon-navy hover:text-hillingdon-navy transition"
                  >
                    <Globe size={14} />
                    {selectedLang?.label}
                    <ChevronDown size={12} className={`transition-transform ${langOpen ? "rotate-180" : ""}`} />
                  </button>
                  {langOpen && (
                    <div
                      role="listbox"
                      className="absolute top-full left-0 mt-1.5 w-44 bg-white border border-gray-200 rounded-xl overflow-hidden py-1 z-20"
                      style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}
                    >
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          role="option"
                          aria-selected={l.code === lang}
                          onClick={() => { setLang(l.code); setLangOpen(false); }}
                          className={`w-full text-left px-3 py-2 text-[13px] transition ${
                            l.code === lang
                              ? "bg-hillingdon-navy-tint text-hillingdon-navy font-semibold"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Search CTA */}
              <button
                onClick={() => submit()}
                disabled={loading || !query.trim()}
                className="btn-primary"
              >
                <Search size={15} />
                Search
                <ArrowRight size={14} />
              </button>

            </div>
          </div>

          {/* Example chips */}
          <div className="flex flex-wrap gap-2 justify-center items-center">
            <span className="text-[12px] text-gray-400 font-medium mr-1">Try:</span>
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => { setQuery(q); submit(q); }}
                className="px-3 py-1.5 text-[13px] bg-white border border-gray-200 rounded-full text-gray-600 hover:border-hillingdon-navy hover:text-hillingdon-navy hover:bg-hillingdon-navy-tint transition shadow-sm"
              >
                {q}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Stats strip */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="grid grid-cols-4 divide-x divide-gray-100">
            {STATS.map((s) => (
              <div key={s.label} className="text-center px-4">
                <div className="text-[18px] font-black text-hillingdon-navy leading-tight">{s.value}</div>
                <div className="text-[11px] text-gray-500 font-medium mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
