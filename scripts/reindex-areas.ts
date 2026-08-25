/**
 * Phase B reindex: computes real Nested Set lft/rght values for every area
 * in the target D1 database (local or remote), from the parentId
 * relationships already loaded by climbs_data/build-seed.ts (Phase A), and
 * applies them. Then resyncs every climb's denormalized
 * lft/rght/send_count/rating_sum/rating_count from that fresh
 * areas.lft/rght and from sends — this used to be a one-off migration
 * (0011_backfill_climb_aggregates.sql) but is really a "run again every time
 * areas get reindexed" step, since climbs.lft/rght only make sense relative
 * to their owning area's current lft/rght.
 *
 * Phase A deliberately writes lft=0, rght=0 placeholders for every area —
 * this script is what replaces those with real values via a DFS over the
 * parentId tree, independent of whatever lft/rght the original JSON export
 * had (which Phase A discarded entirely).
 *
 * Multiple root areas (continents + "Uncategorized") are handled as a
 * forest: each root gets its own disjoint lft/rght range. Nothing in the
 * app's queries (getAncestors, getSubtreeClimbs) assumes a single global
 * root — each area's own lft/rght range is self-contained.
 *
 * Run with: pnpm run db:reindex:local  (or db:reindex:remote)
 */

import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const TARGET = process.argv.includes("--remote") ? "--remote" : "--local";
const OUT_FILE = join(import.meta.dirname, "reindex-areas.sql");
const ROWS_PER_STATEMENT = 20;

type AreaNode = { id: number; parentId: number | null; name: string };

function runD1Query<T>(sql: string): T[] {
  const output = execSync(
    `pnpm wrangler d1 execute DB ${TARGET} --command=${JSON.stringify(sql)} --json`,
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 64 },
  );
  const parsed = JSON.parse(output) as { results: T[] }[];
  return parsed[0]?.results ?? [];
}

// ---------------------------------------------------------------------------
// 1. Read the current area tree from D1
// ---------------------------------------------------------------------------

console.log(`Reading areas from ${TARGET === "--remote" ? "remote" : "local"} D1...`);
const rows = runD1Query<{ id: number; parent_id: number | null; name: string }>(
  "SELECT id, parent_id, name FROM areas",
);

const nodes = new Map<number, AreaNode>();
for (const r of rows) {
  nodes.set(r.id, { id: r.id, parentId: r.parent_id, name: r.name });
}
console.log(`Loaded ${nodes.size} areas.`);

// ---------------------------------------------------------------------------
// 2. Build parent -> children (sorted by name for deterministic ordering)
// ---------------------------------------------------------------------------

const childrenByParent = new Map<number, AreaNode[]>();
const roots: AreaNode[] = [];

for (const node of nodes.values()) {
  if (node.parentId === null) {
    roots.push(node);
  } else {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }
}
roots.sort((a, b) => a.name.localeCompare(b.name));
for (const siblings of childrenByParent.values()) {
  siblings.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// 3. DFS assign lft/rght (forest: each root starts its own disjoint range)
// ---------------------------------------------------------------------------

const bounds = new Map<number, { lft: number; rght: number }>();
let counter = 1;

function visit(node: AreaNode): void {
  const lft = counter++;
  for (const child of childrenByParent.get(node.id) ?? []) {
    visit(child);
  }
  const rght = counter++;
  bounds.set(node.id, { lft, rght });
}

for (const root of roots) visit(root);

if (bounds.size !== nodes.size) {
  const missing = [...nodes.keys()].filter((id) => !bounds.has(id));
  throw new Error(
    `${missing.length} area(s) unreachable from any root (likely a parentId cycle): ${missing.slice(0, 10).join(", ")}`,
  );
}

console.log(`Computed lft/rght for ${bounds.size} areas across ${roots.length} root(s).`);

// ---------------------------------------------------------------------------
// 4. Generate batched UPDATE statements (CASE/WHEN, chunked)
// ---------------------------------------------------------------------------

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const entries = [...bounds.entries()]; // [id, {lft, rght}][]
const statements = chunk(entries, ROWS_PER_STATEMENT).map((batch) => {
  const lftCases = batch.map(([id, b]) => `WHEN ${id} THEN ${b.lft}`).join(" ");
  const rghtCases = batch.map(([id, b]) => `WHEN ${id} THEN ${b.rght}`).join(" ");
  const ids = batch.map(([id]) => id).join(", ");
  return (
    `UPDATE areas SET\n` +
    `  lft = CASE id ${lftCases} END,\n` +
    `  rght = CASE id ${rghtCases} END\n` +
    `WHERE id IN (${ids});`
  );
});

writeFileSync(OUT_FILE, statements.join("\n\n") + "\n");
console.log(`Wrote ${statements.length} UPDATE statement(s) to ${OUT_FILE}`);

// ---------------------------------------------------------------------------
// 5. Apply to D1
// ---------------------------------------------------------------------------
//
// `wrangler d1 execute --file` fails with SQLITE_TOOBIG somewhere between
// 100 and 200 statements sent in one invocation (empirically confirmed —
// unrelated to individual statement or total file size, since a single
// 7.2MB / 7,574-statement INSERT-only file applied fine elsewhere in this
// project). Splitting into smaller per-invocation batches sidesteps it.

const STATEMENTS_PER_APPLY = 80;
const applyBatches = chunk(statements, STATEMENTS_PER_APPLY);
console.log(
  `Applying to ${TARGET === "--remote" ? "remote" : "local"} D1 in ${applyBatches.length} batch(es) of up to ${STATEMENTS_PER_APPLY} statements...`,
);
const tmpDir = mkdtempSync(join(tmpdir(), "reindex-areas-"));
try {
  applyBatches.forEach((batch, i) => {
    const batchFile = join(tmpDir, `part${i}.sql`);
    writeFileSync(batchFile, batch.join("\n\n") + "\n");
    execSync(`pnpm wrangler d1 execute DB ${TARGET} --file=${batchFile}`, { stdio: "inherit" });
    console.log(`  applied batch ${i + 1}/${applyBatches.length}`);
  });
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 6. Resync climbs.lft/rght/send_count/rating_sum/rating_count
// ---------------------------------------------------------------------------
//
// Correlated-subquery UPDATEs with zero bound parameters, so — unlike the
// area lft/rght batches above — D1's per-statement bound-parameter/request
// limits don't apply regardless of table size; no chunking needed.

console.log("Resyncing climb lft/rght and send aggregates...");
const resyncTmpDir = mkdtempSync(join(tmpdir(), "reindex-areas-resync-"));
try {
  const resyncFile = join(resyncTmpDir, "resync.sql");
  writeFileSync(
    resyncFile,
    [
      `UPDATE climbs SET
  lft = (SELECT areas.lft FROM areas WHERE areas.id = climbs.area_id),
  rght = (SELECT areas.rght FROM areas WHERE areas.id = climbs.area_id);`,
      `UPDATE climbs SET
  send_count = (SELECT COUNT(*) FROM sends WHERE sends.climb_id = climbs.id),
  rating_sum = (SELECT COALESCE(SUM(rating), 0) FROM sends WHERE sends.climb_id = climbs.id AND rating IS NOT NULL),
  rating_count = (SELECT COUNT(*) FROM sends WHERE sends.climb_id = climbs.id AND rating IS NOT NULL);`,
    ].join("\n\n") + "\n",
  );
  execSync(`pnpm wrangler d1 execute DB ${TARGET} --file=${resyncFile}`, { stdio: "inherit" });
} finally {
  rmSync(resyncTmpDir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// 7. Verify
// ---------------------------------------------------------------------------

const stillZero = runD1Query<{ count: number }>(
  "SELECT COUNT(*) as count FROM areas WHERE lft = 0 AND rght = 0",
);
console.log(`Areas still at 0/0 placeholder: ${stillZero[0]?.count ?? "unknown"}`);
console.log("Done.");
