import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Repairs the HTML entity artifacts in `climbs.name` ("Jekyll &amp Hyde").
 *
 *   pnpm backfill:climb-names                 # dry run against production
 *   pnpm backfill:climb-names --apply         # dry run, then write
 *   pnpm backfill:climb-names --local         # rehearse against .wrangler
 *
 * Nothing is written without `--apply`. Every run first writes three files to
 * `--out` (default `./backfill-out`), which are worth reading before applying:
 *
 *   climb-names.sql           the UPDATEs, in order
 *   climb-names.rollback.sql  the inverse, restoring every previous name
 *   climb-names.csv           id, before, after
 *
 * Each UPDATE carries the old name in its WHERE clause, so the script is
 * idempotent, and a name edited by someone else between the dry run and the
 * apply is skipped rather than overwritten.
 *
 * Two things to know before running this against production:
 *
 * - Climb names are a moderation-gated field. This writes to the table
 *   directly and leaves no moderation record, which is the right call for
 *   repairing an encoding artifact and the wrong one for a rename.
 * - The `climbs_fts_after_update` trigger fires on `UPDATE OF name`, so the
 *   search index follows automatically. No reindex step is needed.
 */
import { hasUnhandledEntity, repairClimbName } from "./climb-name-entities.ts";
import { requireLocalDb } from "./d1-local.ts";

type Row = { id: number; name: string };
type Change = { id: number; before: string; after: string };

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const local = args.has("--local");
const outArg = process.argv.slice(2).find((a) => a.startsWith("--out="));
const outDir = outArg ? outArg.slice("--out=".length) : "backfill-out";

/** Statements per file. D1 executes a file as one batch, so this keeps any
 * single request modest and makes a partial failure easy to locate. */
const CHUNK_SIZE = 500;
const PAGE_SIZE = 500;

const WRANGLER = path.join("node_modules", ".bin", "wrangler");

function wrangler(argv: string[]): string {
  return execFileSync(WRANGLER, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** `wrangler d1 execute --json` prints an array of per-statement results. */
function remoteQuery(sql: string): Row[] {
  const raw = wrangler(["d1", "execute", "DB", "--remote", "--json", "--command", sql]);
  const start = raw.indexOf("[");
  if (start === -1) throw new Error(`Unexpected wrangler output:\n${raw}`);
  const parsed = JSON.parse(raw.slice(start)) as { results?: Row[] }[];
  return parsed.flatMap((r) => r.results ?? []);
}

/** Every climb whose name contains an ampersand, paged by id so a large result
 * never depends on one oversized response. */
function readCandidates(): Row[] {
  const rows: Row[] = [];
  if (local) {
    const db = new DatabaseSync(requireLocalDb(), { readOnly: true });
    const stmt = db.prepare(`SELECT id, name FROM climbs WHERE name LIKE '%&%' ORDER BY id`);
    for (const row of stmt.all() as Row[]) rows.push(row);
    db.close();
    return rows;
  }
  let after = 0;
  for (;;) {
    const page = remoteQuery(
      `SELECT id, name FROM climbs WHERE name LIKE '%&%' AND id > ${after} ORDER BY id LIMIT ${PAGE_SIZE}`,
    );
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    after = page[page.length - 1].id;
  }
}

/** How many changed names to print; the CSV always holds the full list. */
const PREVIEW_LIMIT = 15;

/** SQL string literal quoting, which doubles `'`. */
const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** CSV field quoting, which doubles `"` — not the SQL quoting above. */
const csvField = (value: string) => `"${value.replace(/"/g, '""')}"`;

function statements(changes: Change[], to: (c: Change) => string, from: (c: Change) => string) {
  return changes.map(
    (c) =>
      `UPDATE climbs SET name = ${quote(to(c))} WHERE id = ${c.id} AND name = ${quote(from(c))};`,
  );
}

function writeChunks(dir: string, base: string, lines: string[]): string[] {
  const files: string[] = [];
  for (let i = 0; i * CHUNK_SIZE < lines.length; i += 1) {
    const chunk = lines.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const suffix = lines.length > CHUNK_SIZE ? `.${String(i + 1).padStart(3, "0")}` : "";
    const file = path.join(dir, `${base}${suffix}.sql`);
    writeFileSync(file, `${chunk.join("\n")}\n`);
    files.push(file);
  }
  return files;
}

function main(): void {
  const candidates = readCandidates();
  const changes: Change[] = [];
  const unhandled: Row[] = [];
  for (const row of candidates) {
    const after = repairClimbName(row.name);
    if (after !== row.name) changes.push({ id: row.id, before: row.name, after });
    if (hasUnhandledEntity(row.name)) unhandled.push(row);
  }

  console.log(`${local ? "local" : "production"}: ${candidates.length} climb names contain "&"`);
  console.log(`${changes.length} to repair`);

  if (changes.length === 0 && unhandled.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  mkdirSync(outDir, { recursive: true });
  const forward = writeChunks(
    outDir,
    "climb-names",
    statements(
      changes,
      (c) => c.after,
      (c) => c.before,
    ),
  );
  writeChunks(
    outDir,
    "climb-names.rollback",
    statements(
      changes,
      (c) => c.before,
      (c) => c.after,
    ),
  );
  const csv = [
    "id,before,after",
    ...changes.map((c) => `${c.id},${csvField(c.before)},${csvField(c.after)}`),
  ].join("\n");
  writeFileSync(path.join(outDir, "climb-names.csv"), `${csv}\n`);

  for (const c of changes.slice(0, PREVIEW_LIMIT)) {
    console.log(`  ${c.id}  ${JSON.stringify(c.before)} -> ${JSON.stringify(c.after)}`);
  }
  if (changes.length > PREVIEW_LIMIT) {
    console.log(`  …and ${changes.length - PREVIEW_LIMIT} more (see the CSV)`);
  }

  if (unhandled.length > 0) {
    console.log(
      `\n${unhandled.length} name(s) hold an entity shape this rule does not repair. ` +
        `They are left alone — extend scripts/climb-name-entities.ts if they should be covered:`,
    );
    for (const row of unhandled.slice(0, PREVIEW_LIMIT)) {
      console.log(`  ${row.id}  ${JSON.stringify(row.name)}`);
    }
  }

  console.log(`\nWrote ${forward.length} statement file(s) and a rollback to ${outDir}/`);

  if (!apply) {
    console.log("Dry run. Re-run with --apply to write these changes.");
    return;
  }
  if (changes.length === 0) {
    console.log("Nothing to apply.");
    return;
  }

  for (const [i, file] of forward.entries()) {
    console.log(`Applying ${file} (${i + 1}/${forward.length})…`);
    if (local) {
      const db = new DatabaseSync(requireLocalDb());
      db.exec(readFileSync(file, "utf8"));
      db.close();
    } else {
      wrangler(["d1", "execute", "DB", "--remote", `--file=${file}`, "--yes"]);
    }
  }
  console.log(`Applied ${changes.length} name repairs. Roll back with the .rollback.sql files.`);
}

main();
