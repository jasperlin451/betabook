import { defineConfig } from "@playwright/test";

import { appBaseURL, appPort } from "@/tests/ui/app-server";

export default defineConfig({
  testDir: "./tests/ui",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:6007",
    browserName: "chromium",
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    contextOptions: { reducedMotion: "reduce" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Behavior that needs a browser but is independent of viewport/theme runs
  // once in desktop-light. Visual and responsive checks keep the full matrix.
  projects: [
    {
      name: "desktop-light",
      use: { viewport: { width: 1024, height: 900 }, colorScheme: "light" },
    },
    {
      name: "desktop-dark",
      testIgnore: "**/artifacts.spec.ts",
      grepInvert: /@behavior/,
      use: { viewport: { width: 1024, height: 900 }, colorScheme: "dark" },
    },
    {
      name: "mobile-light",
      testIgnore: "**/artifacts.spec.ts",
      grepInvert: /@behavior/,
      use: { viewport: { width: 375, height: 812 }, colorScheme: "light", hasTouch: true },
    },
    {
      name: "mobile-dark",
      testIgnore: "**/artifacts.spec.ts",
      grepInvert: /@behavior/,
      use: { viewport: { width: 375, height: 812 }, colorScheme: "dark", hasTouch: true },
    },
  ],
  webServer: [
    {
      command:
        "pnpm exec vite preview --outDir storybook-static --host 127.0.0.1 --port 6007 --strictPort",
      url: "http://127.0.0.1:6007/index.json",
      reuseExistingServer: false,
    },
    {
      command: `pnpm db:migrate:local && pnpm dev --port ${appPort}`,
      // Warm the homepage's cold compilation before measuring home-link navigation.
      url: appBaseURL,
      reuseExistingServer: true,
    },
  ],
});
