/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "hillingdon-navy":       "#0F172A",
        "hillingdon-navy-dark":  "#020617",
        "hillingdon-navy-tint":  "#F0F9FF",
        "hillingdon-teal":       "#0891B2",
        "hillingdon-green":      "#059669",
        "civic-slate":           "#475569",
        "civic-surface":         "#F8FAFC",
        "civic-border":          "#E2E8F0",
      },
      fontFamily: {
        sans:    ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "Inter", "sans-serif"],
      },
      boxShadow: {
        "civic":      "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
        "civic-md":   "0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)",
        "civic-lg":   "0 12px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.05)",
        "civic-hover":"0 8px 32px rgba(26,63,111,0.16), 0 3px 10px rgba(0,0,0,0.06)",
        "card":       "0 2px 8px rgba(26,63,111,0.08), 0 1px 3px rgba(0,0,0,0.04)",
        "glow":       "0 0 0 3px rgba(26,63,111,0.15)",
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
