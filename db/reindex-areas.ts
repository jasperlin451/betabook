import { revalidatePath } from "next/cache";
import { inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { areas, climbs, treeVersion } from "@/db/schema";

const ROWS_PER_STATEMENT = 20;
const MAX_ATTEMPTS = 5;

export type AreaNode = { id: number; parentId: number | null; name: string };
export type AreaBounds = Map<number, { lft: number; rght: number }>;

/** DFS-assigns nested-set lft/rght over a parentId forest (multiple roots —
 * continents + "Uncategorized" — each get their own disjoint range), sorted
 * by name for deterministic ordering. Pure/no I/O — ported from
 * scripts/reindex-areas.ts so it's unit-testable in isolation. */
export function computeAreaBounds(nodes: AreaNode[]): AreaBounds {
  const childrenByParent = new Map<number, AreaNode[]>();
  const roots: AreaNode[] = [];

  for (const node of nodes) {
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

  const bounds: AreaBounds = new Map();
  let counter = 1;

  function visit(node: AreaNode): void {
    const lft = counter++;
    for (const child of childrenByParent.get(node.id) ?? []) visit(child);
    const rght = counter++;
    bounds.set(node.id, { lft, rght });
  }
  for (const root of roots) visit(root);

  if (bounds.size !== nodes.length) {
    const missing = nodes.filter((n) => !bounds.has(n.id)).map((n) => n.id);
    throw new Error(
      `${missing.length} area(s) unreachable from any root (likely a parentId cycle): ${missing.slice(0, 10).join(", ")}`,
    );
  }

  return bounds;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// D1's batch() only aborts on a thrown error, not on an UPDATE that merely
// affects 0 rows — so the version claim below must be an INSERT that can
// hit a real PRIMARY KEY conflict, not a conditional UPDATE. See
// drizzle/schema/tree-version.ts.
function isVersionConflict(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /unique constraint failed|constraint failed/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RecomputeOptions = {
  /** Paths to revalidate again once this recompute actually commits, so a
   * cached render doesn't keep serving stale lft/rght to other users/tabs
   * after the tree has converged (the triggering mutation's own
   * revalidatePath calls only cover the synchronous, still-stale insert). */
  revalidatePaths?: string[];
};

/** Recomputes and writes nested-set lft/rght for every area from current
 * parentId relationships, guarded by an optimistic-concurrency version claim
 * so concurrent recomputes (e.g. two createArea calls close together) can't
 * interleave their write phases into a corrupted tree. Safe to call
 * redundantly/concurrently — retries on losing the race rather than
 * discarding, since a loss doesn't guarantee the winner's snapshot already
 * included whatever this call's own trigger just inserted. */
export async function recomputeAreaTree(db: Database, options: RecomputeOptions = {}): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const rows = await db
      .select({ id: areas.id, parentId: areas.parentId, name: areas.name })
      .from(areas);
    const bounds = computeAreaBounds(rows);

    const [{ current }] = await db
      .select({ current: sql<number>`max(${treeVersion.version})` })
      .from(treeVersion);

    const entries = [...bounds.entries()];
    const areaUpdates = chunk(entries, ROWS_PER_STATEMENT).map((batch) => {
      const ids = batch.map(([id]) => id);
      const lftCases = sql.join(
        batch.map(([id, b]) => sql`WHEN ${id} THEN ${b.lft}`),
        sql` `,
      );
      const rghtCases = sql.join(
        batch.map(([id, b]) => sql`WHEN ${id} THEN ${b.rght}`),
        sql` `,
      );
      return db
        .update(areas)
        .set({
          lft: sql`CASE ${areas.id} ${lftCases} END`,
          rght: sql`CASE ${areas.id} ${rghtCases} END`,
        })
        .where(inArray(areas.id, ids));
    });

    const climbsResync = db.update(climbs).set({
      lft: sql`(SELECT ${areas.lft} FROM ${areas} WHERE ${areas.id} = ${climbs.areaId})`,
      rght: sql`(SELECT ${areas.rght} FROM ${areas} WHERE ${areas.id} = ${climbs.areaId})`,
    });

    try {
      await db.batch([db.insert(treeVersion).values({ version: current + 1 }), ...areaUpdates, climbsResync]);
      for (const path of options.revalidatePaths ?? []) revalidatePath(path);
      return;
    } catch (err) {
      if (!isVersionConflict(err)) throw err;
      if (attempt === MAX_ATTEMPTS) {
        console.error(
          `recomputeAreaTree: gave up after ${MAX_ATTEMPTS} attempts, still losing the tree_version race`,
          err,
        );
        return;
      }
      await sleep(10 * attempt + Math.random() * 20);
    }
  }
}
