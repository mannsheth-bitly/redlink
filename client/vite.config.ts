import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One .env at the project root for both server and client (only VITE_* vars reach the browser).
  envDir: "..",
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  // Pre-bundle libraries that only lazy-loaded pages use, so the dev server doesn't re-optimise
  // (and break already-open tabs) the first time someone opens those pages.
  optimizeDeps: { include: ["recharts", "leaflet", "react-leaflet"] },
  server: {
    port: 5173,
    // Development: the React app on :5173 forwards API calls to Express on :4000.
    proxy: { "/api": "http://localhost:4000" },
  },
});
