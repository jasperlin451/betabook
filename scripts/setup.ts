/**
 * Brings a fresh checkout to the point where `pnpm dev` serves real data and
 * you can sign in. Idempotent.
 *
 *   pnpm setup
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const D1_DIR = path.join(".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");

const run = (script: string, args: string[] = []) =>
  execFileSync("pnpm", ["run", script, ...args], { stdio: "inherit" });

const hasLocalDb = () =>
  existsSync(D1_DIR) &&
  readdirSync(D1_DIR).some((name) => name.endsWith(".sqlite") && !name.startsWith("metadata"));

/** Each returns false when there was nothing to do. */
const steps: [name: string, body: () => boolean][] = [
  [
    ".dev.vars",
    () => {
      if (existsSync(".dev.vars")) return false;
      // Without it BETTER_AUTH_URL falls back to the production value in
      // wrangler.jsonc, pointing local verification links at the live site.
      copyFileSync(".dev.vars.example", ".dev.vars");
      return true;
    },
  ],
  [
    "database",
    () => {
      if (hasLocalDb()) return false;
      try {
        run("db:restore");
      } catch {
        // Usually just no snapshot yet. db:restore has already printed the real
        // reason, so don't restate it as one.
        console.log("\n`pnpm db:restore` failed (above) — creating an empty database instead.");
        run("db:migrate:local");
      }
      return true;
    },
  ],
  // Always runs: re-seeding rotates the password but keeps the user id.
  [
    "dev user",
    () => {
      run("seed:user");
      return true;
    },
  ],
];

for (const [name, body] of steps) {
  console.log(`\n== ${name}`);
  try {
    if (!body()) console.log("already set up — skipped");
  } catch (error) {
    console.error(`\n${name} failed:`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    break;
  }
}

if (process.exitCode === undefined) {
  console.log("\nReady. Start the dev server with `pnpm dev`.");
}
