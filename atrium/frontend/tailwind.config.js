/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "hillingdon-navy":       "#1B4F8C",
        "hillingdon-navy-dark":  "#153D6E",
        "hillingdon-navy-tint":  "#EBF4FF",
        "hillingdon-teal":       "#0EA5E9",
        "hillingdon-teal-light": "#E0F2FE",
        "hillingdon-green":      "#059669",
        "hillingdon-green-light":"#ECFDF5",
        "civic-slate":           "#475569",
        "civic-surface":         "#F8FAFC",
        "civic-border":          "#E2E8F0",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        "civic":      "0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)",
        "civic-md":   "0 4px 16px rgba(0,0,0,0.07), 0 2px 6px rgba(0,0,0,0.04)",
        "civic-lg":   "0 8px 32px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)",
        "civic-hover":"0 8px 28px rgba(27,79,140,0.14), 0 3px 10px rgba(0,0,0,0.06)",
        "card":       "0 2px 8px rgba(27,79,140,0.08), 0 1px 3px rgba(0,0,0,0.04)",
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "20px",
      },
      animation: {
        "fade-in":   "fadeIn 0.3s ease-out",
        "slide-up":  "slideUp 0.35s ease-out",
        "slide-in":  "slideIn 0.4s ease-out",
        "skeleton":  "skeleton 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:  { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        slideIn:  { from: { opacity: 0, transform: "translateX(16px)" }, to: { opacity: 1, transform: "translateX(0)" } },
        skeleton: {
          "0%, 100%": { opacity: 0.45 },
          "50%":      { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
