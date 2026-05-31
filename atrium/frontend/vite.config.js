import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // VITE_BASE_URL is set to /HillingOne/ in the GitHub Actions deploy workflow.
  // Defaults to / for local development.
  base: process.env.VITE_BASE_URL || "/",
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
