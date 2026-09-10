import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, expect, it } from "vitest";

import { TERMS_VERSION } from "@/lib/terms";

let directory: string;
let db: DatabaseSync;

beforeEach(() => {
  directory = mkdtempSync(path.join(tmpdir(), "betabook-seed-"));
  const state = path.join(directory, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  mkdirSync(state, { recursive: true });
  db = new DatabaseSync(path.join(state, "test.sqlite"));
  db.exec("PRAGMA foreign_keys = ON");
  const migrations = path.resolve(import.meta.dirname, "../drizzle/migrations");
  for (const file of readdirSync(migrations)
    .filter((file) => file.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(path.join(migrations, file), "utf8"));
  }
});

afterEach(() => {
  db.close();
  rmSync(directory, { recursive: true, force: true });
});

function seed(...args: string[]) {
  execFileSync(process.execPath, [path.join(import.meta.dirname, "seed.ts"), ...args], {
    cwd: directory,
    stdio: "pipe",
  });
}

function acceptances() {
  return db
    .prepare(
      "SELECT u.email, u.terms_version, u.terms_accepted_at, t.version, t.accepted_at FROM user u LEFT JOIN user_terms_acceptances t ON t.user_id = u.id ORDER BY u.email, t.version",
    )
    .all();
}

function expectSeedTerms(count: number, email = "dev@example.com") {
  const rows = acceptances();
  const expectedEmails = [
    email,
    ...Array.from({ length: count }, (_, i) => `climber${i + 1}@example.com`),
  ].sort();
  const seeded = rows.filter((row) => expectedEmails.includes(String(row.email)));
  const current = seeded.filter((row) => row.version === TERMS_VERSION || row.version === null);
  expect(current.map((row) => row.email)).toEqual(expectedEmails);
  for (const row of current) {
    if (row.email === `climber${count}@example.com`) {
      expect(row).toEqual({
        email: row.email,
        terms_version: null,
        terms_accepted_at: null,
        version: null,
        accepted_at: null,
      });
    } else {
      expect(row).toMatchObject({
        terms_version: TERMS_VERSION,
        terms_accepted_at: expect.any(Number),
        version: TERMS_VERSION,
        accepted_at: row.terms_accepted_at,
      });
      expect(Number(row.terms_accepted_at)).toBeGreaterThan(0);
    }
  }
}

it("accepts current terms for dev and the default climbers except climber50", () => {
  seed("--areas", "2", "--climbs", "8");

  expectSeedTerms(50);
  expect(db.prepare("SELECT count(*) AS n FROM user").get()?.n).toBe(51);
  expect(db.prepare("SELECT count(*) AS n FROM user_terms_acceptances").get()?.n).toBe(50);
});

it("refreshes existing accounts and resets the exception without changing unrelated users or first acceptances", () => {
  seed("--areas", "2", "--climbs", "8", "--users", "3");
  const development = acceptances().find((row) => row.email === "dev@example.com");
  const climbs = db.prepare("SELECT * FROM climbs ORDER BY id").all();
  db.exec(`
    UPDATE user SET terms_version = NULL, terms_accepted_at = NULL WHERE email = 'climber1@example.com';
    DELETE FROM user_terms_acceptances WHERE user_id = (SELECT id FROM user WHERE email = 'climber1@example.com');
    UPDATE user SET terms_version = '2025-01-01', terms_accepted_at = 1234 WHERE email = 'climber2@example.com';
    INSERT INTO user (id, name, email, terms_version, terms_accepted_at)
      VALUES ('unrelated', 'Unrelated User', 'unrelated@example.com', '2025-01-01', 5678);
  `);
  const unrelated = db.prepare("SELECT * FROM user WHERE id = 'unrelated'").get();
  const unrelatedHistory = db
    .prepare("SELECT * FROM user_terms_acceptances WHERE user_id = 'unrelated'")
    .all();

  // Accept the exceptional account as a tester would, then restore the seed twice.
  for (const args of [[], ["--social"]]) {
    db.prepare(
      "UPDATE user SET terms_version = ?, terms_accepted_at = 9999 WHERE email = 'climber3@example.com'",
    ).run(TERMS_VERSION);
    seed(...args);

    expectSeedTerms(3);
    expect(acceptances().find((row) => row.email === "dev@example.com")).toEqual(development);
    expect(db.prepare("SELECT * FROM user WHERE id = 'unrelated'").get()).toEqual(unrelated);
    expect(
      db.prepare("SELECT * FROM user_terms_acceptances WHERE user_id = 'unrelated'").all(),
    ).toEqual(unrelatedHistory);
    expect(db.prepare("SELECT * FROM climbs ORDER BY id").all()).toEqual(climbs);
    expect(
      db
        .prepare(
          "SELECT accepted_at FROM user_terms_acceptances WHERE user_id = (SELECT id FROM user WHERE email = 'climber2@example.com') AND version = '2025-01-01'",
        )
        .get(),
    ).toEqual({ accepted_at: 1234 });
  }
  const snapshot = acceptances();
  seed();
  expect(acceptances()).toEqual(snapshot);
});

it("keeps exactly one unaccepted climber in a one-user seed and after force regeneration", () => {
  const args = ["--areas", "1", "--climbs", "4", "--email", "tester@example.com"];
  seed(...args, "--users", "1");
  expectSeedTerms(1, "tester@example.com");

  seed(...args, "--users", "2", "--force");
  expectSeedTerms(2, "tester@example.com");
  expect(db.prepare("SELECT count(*) AS n FROM user").get()?.n).toBe(3);
});
