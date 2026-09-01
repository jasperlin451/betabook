import path from "node:path";
import { defineConfig } from "vitest/config";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  resolve: {
    alias: {
      "@": import.meta.dirname,
    },
  },
  plugins: [
    cloudflareTest(async () => {
      const migrationsPath = path.join(import.meta.dirname, "drizzle/migrations");
      const migrations = await readD1Migrations(migrationsPath);

      return {
        // Tests import query/mutation modules directly; they do not need the
        // deployed OpenNext entrypoint to have been built first.
        main: "./test/worker.ts",
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      };
    }),
  ],
  test: {
    include: [
      "app/**/*.test.{ts,tsx}",
      "components/**/*.test.{ts,tsx}",
      "db/**/*.test.{ts,tsx}",
      "lib/**/*.test.{ts,tsx}",
    ],
    exclude: [".claude/**", "node_modules/**"],
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
