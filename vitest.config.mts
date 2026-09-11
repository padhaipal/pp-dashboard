import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vite 8 resolves tsconfig "paths" (@/*) natively; no vite-tsconfig-paths plugin.
export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
