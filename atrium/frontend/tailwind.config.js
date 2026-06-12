/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "hillingdon-navy":       "#0D9488",   // teal-600 — brand primary
        "hillingdon-navy-dark":  "#0F766E",   // teal-700 — hover/dark
        "hillingdon-navy-tint":  "#F0FDFA",   // teal-50 — background tints
        "hillingdon-teal":       "#14B8A6",   // teal-500 — accent
        "hillingdon-green":      "#059669",
        "civic-slate":           "#475569",
        "civic-surface":         "#F9FAFB",
        "civic-border":          "#E5E7EB",
      },
      fontFamily: {
        sans:    ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "Inter", "sans-serif"],
      },
      boxShadow: {
        // Neutral elevation — refined-premium (depth from value, not colour).
        "civic":      "0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)",
        "civic-md":   "0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)",
        "civic-lg":   "0 12px 32px rgba(15,23,42,0.10), 0 4px 8px rgba(15,23,42,0.04)",
        "civic-hover":"0 12px 32px rgba(15,23,42,0.12), 0 4px 8px rgba(15,23,42,0.05)",
        "card":       "0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.04)",
        "glow":       "0 0 0 3px rgba(13,148,136,0.16)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
        "4xl": "32px",
      },
    },
  },
  plugins: [],
};
