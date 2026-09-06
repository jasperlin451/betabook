import { defineConfig } from "@playwright/test";

import gallery from "./playwright.config";

export default defineConfig({
  ...gallery,
  testDir: "./tests/brand",
  use: { ...gallery.use, baseURL: "http://localhost:3002" },
  webServer: {
    command: "pnpm dev --port 3002",
    url: "http://localhost:3002/about",
    reuseExistingServer: true,
  },
});
