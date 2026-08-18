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
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      };
    }),
  ],
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
