import { useState } from "react";
import { X, Cookie } from "lucide-react";

const STORAGE_KEY = "hillingone_cookie_notice_dismissed";

export default function CookieBanner({ onOpenPolicy }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1"
  );

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9990] px-4 pb-4 sm:px-6 sm:pb-6"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="max-w-2xl mx-auto rounded-2xl px-5 py-4 flex items-center gap-4"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
          pointerEvents: "all",
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--brand)" }}
        >
          <Cookie size={16} className="text-white" />
        </div>

        <p className="flex-1 text-[13px] text-gray-600 leading-relaxed">
          We use <strong className="text-gray-900">essential cookies only</strong> — no tracking, no ads.{" "}
          <button
            onClick={onOpenPolicy}
            className="text-teal-600 font-semibold hover:underline"
          >
            Cookie policy
          </button>
        </p>

        <button
          onClick={dismiss}
          className="flex-shrink-0 px-4 py-2 rounded-xl text-[13px] font-semibold transition"
          style={{
            background: "var(--surface-2)",
            color: "var(--text-1)",
          }}
        >
          Got it
        </button>

        <button
          onClick={dismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition"
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
