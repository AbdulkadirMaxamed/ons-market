import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure modules (app/lib). Kept apart from vite.config.ts so the Cloudflare and React Router
// plugins don't load.
export default defineConfig({
  resolve: { alias: { "~": fileURLToPath(new URL("./app", import.meta.url)) } },
  test: { include: ["app/**/*.test.ts"] },
});
