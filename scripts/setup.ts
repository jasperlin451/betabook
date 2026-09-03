/**
 * Brings a fresh checkout to the point where `pnpm dev` serves real data and
 * you can sign in. Idempotent.
 *
 *   pnpm setup
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { findLocalDb, requireLocalDb } from "./d1-local.ts";

const run = (script: string, args: string[] = []) =>
  execFileSync("pnpm", ["run", script, ...args], { stdio: "inherit" });

const hasLocalDb = () => findLocalDb() !== undefined;

function climbCount(): number {
  const db = new DatabaseSync(requireLocalDb(), { readOnly: true });
  try {
    return (db.prepare("select count(*) c from climbs").get() as { c: number }).c;
  } finally {
    db.close();
  }
}

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
        console.log("\n`pnpm db:restore` failed (above) — starting from an empty schema.");
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
  // After the dev user, so the ticks it generates cover that account too.
  [
    "sample data",
    () => {
      if (climbCount() > 0) return false;
      run("seed:climbs");
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
