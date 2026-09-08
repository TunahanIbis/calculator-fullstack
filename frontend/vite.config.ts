import process from "node:process";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// In development the app calls the API with relative URLs (`/api/...`). This
// proxy forwards those to the Go service so there are no CORS concerns locally.
// In production, a reverse proxy (see nginx.conf) plays the same role.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET ?? "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main.tsx",
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
      ],
    },
  },
});
