/**
 * Saves and restores the local D1 database as a file.
 *
 *   pnpm db:snapshot           # save this checkout's DB to the shared cache
 *   pnpm db:restore            # clone the cached DB into this checkout
 *   pnpm db:restore --force    # overwrite a DB that already has rows
 */
import { execFileSync } from "node:child_process";
import { constants, copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { D1_DIR, findLocalDb } from "./d1-local.ts";

const SNAPSHOT_DIR =
  // oxlint-disable-next-line node/no-process-env
  process.env.BETABOOK_SNAPSHOT_DIR ?? path.join(homedir(), ".cache", "betabook");
const SNAPSHOT_DB = path.join(SNAPSHOT_DIR, "d1-seed.sqlite");
const SNAPSHOT_META = path.join(SNAPSHOT_DIR, "d1-seed.json");

interface SnapshotMeta {
  /** Restored under this name, so the hash is never hardcoded here. */
  file: string;
  bytes: number;
  savedAt: string;
  latestMigration: string | null;
  counts: Record<string, number>;
}

const COUNTED_TABLES = ["areas", "climbs", "sends", "user"];

const [mode] = process.argv.slice(2);
const force = process.argv.includes("--force");

try {
  if (mode === "save") save();
  else if (mode === "restore") restore();
  else {
    console.error("Usage: db-snapshot.ts <save|restore> [--force]");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

/**
 * These databases run in WAL mode, so committed rows can still be sitting in
 * the -wal when the .sqlite is copied. Folding them in first is what makes the
 * snapshot a single self-contained file.
 */
function checkpoint(file: string) {
  let db;
  try {
    db = new DatabaseSync(file);
    db.exec("pragma wal_checkpoint(truncate)");
  } catch (error) {
    throw new Error(
      `Could not checkpoint ${file} — stop \`pnpm dev\`, which holds the database open.`,
      { cause: error },
    );
  } finally {
    db?.close();
  }
}

/** A .sqlite restored beside another database's -wal/-shm reads as corrupt. */
function removeSidecars(file: string) {
  for (const suffix of ["-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });
}

function inspect(file: string): Pick<SnapshotMeta, "latestMigration" | "counts"> {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const counts: Record<string, number> = {};
    for (const table of COUNTED_TABLES) {
      // A snapshot predating a table is still worth restoring.
      try {
        counts[table] = (db.prepare(`select count(*) c from ${table}`).get() as { c: number }).c;
      } catch {
        continue;
      }
    }
    const row = db.prepare("select max(name) n from d1_migrations").get() as { n: string | null };
    return { latestMigration: row.n, counts };
  } finally {
    db.close();
  }
}

function describe(meta: Pick<SnapshotMeta, "counts">): string {
  const parts = Object.entries(meta.counts).map(
    ([table, count]) => `${count.toLocaleString()} ${table}`,
  );
  return parts.length > 0 ? parts.join(", ") : "no counted tables";
}

function save() {
  const file = findLocalDb();
  if (!file) {
    throw new Error(
      `No local database under ${D1_DIR}. Run \`pnpm db:migrate:local\` (and seed it) first.`,
    );
  }

  const source = path.join(D1_DIR, file);
  checkpoint(source);
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  // FICLONE, not FICLONE_FORCE: clone where the filesystem can, copy otherwise.
  copyFileSync(source, SNAPSHOT_DB, constants.COPYFILE_FICLONE);

  const meta: SnapshotMeta = {
    file,
    bytes: statSync(SNAPSHOT_DB).size,
    savedAt: new Date().toISOString(),
    // Read the source, not the copy: opening a WAL-mode file even read-only
    // leaves -wal/-shm beside it.
    ...inspect(source),
  };
  writeFileSync(SNAPSHOT_META, `${JSON.stringify(meta, null, 2)}\n`);

  console.log(`Saved ${SNAPSHOT_DB}`);
  console.log(`  ${(meta.bytes / 1_048_576).toFixed(1)} MB — ${describe(meta)}`);
  console.log(`  through migration ${meta.latestMigration ?? "(none applied)"}`);
  console.log("\nStop `pnpm dev` before saving: it holds the D1 handle open.");
}

function restore() {
  if (!existsSync(SNAPSHOT_DB) || !existsSync(SNAPSHOT_META)) {
    throw new Error(
      `No snapshot at ${SNAPSHOT_DB}. Run \`pnpm db:snapshot\` in a checkout that has one.`,
    );
  }

  const meta = JSON.parse(readFileSync(SNAPSHOT_META, "utf8")) as SnapshotMeta;
  const target = path.join(D1_DIR, meta.file);

  const existing = findLocalDb();
  if (existing && !force) {
    const { counts } = inspect(path.join(D1_DIR, existing));
    if (Object.values(counts).some((count) => count > 0)) {
      throw new Error(
        `${path.join(D1_DIR, existing)} already holds data (${describe({ counts })}).\n` +
          "Pass --force to replace it.",
      );
    }
  }

  mkdirSync(D1_DIR, { recursive: true });
  removeSidecars(target);
  copyFileSync(SNAPSHOT_DB, target, constants.COPYFILE_FICLONE);
  console.log(`Restored ${describe(meta)} (snapshot from ${meta.savedAt})`);

  // The snapshot carries its own d1_migrations rows, so this applies only what
  // the branch adds on top.
  execFileSync("wrangler", ["d1", "migrations", "apply", "DB", "--local"], { stdio: "inherit" });
  console.log("\nRestart `pnpm dev`: it will not notice a swapped database.");
}
