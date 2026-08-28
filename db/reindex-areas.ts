import { and, asc, eq, gt, gte, inArray, isNull, sql } from "drizzle-orm";
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

/** Recomputes and writes nested-set lft/rght for every area from current
 * parentId relationships, guarded by an optimistic-concurrency version claim
 * so concurrent recomputes (e.g. two createArea calls close together) can't
 * interleave their write phases into a corrupted tree. Safe to call
 * redundantly/concurrently — retries on losing the race rather than
 * discarding, since a loss doesn't guarantee the winner's snapshot already
 * included whatever this call's own trigger just inserted.
 *
 * Deliberately does not call revalidatePath after committing: this runs
 * inside a ctx.waitUntil background task, and OpenNext's Cloudflare adapter
 * keeps that task in the same async-context scope as request handling for
 * the whole worker invocation, so Next's render-tracking machinery can
 * still flag a revalidatePath call here as happening "during render" of
 * whatever request happens to be in flight at that moment — not a dev-only
 * quirk, since it's about Next's own context tracking, not real request
 * lifecycle. The synchronous revalidatePath calls in createArea/createClimb
 * already cover the creating user's own view; other viewers just see the
 * stale cached render until it naturally expires or another mutation
 * touches the same path. */
export async function recomputeAreaTree(db: Database): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Claim target first, tree snapshot second. Every bounds writer
    // (another recompute, insertAreaIntoTree's synchronous splice) claims
    // the next version in the same atomic batch as its writes, so anything
    // that commits after this read makes this attempt's own claim conflict
    // and retry against a fresh snapshot. Read the other way around, a
    // write landing between the snapshot and the version read would slip
    // through: this attempt would claim successfully and renumber every
    // *snapshotted* area around bounds it never saw — e.g. leaving a
    // just-spliced area holding a range that now overlaps its neighbors'.
    const [{ current }] = await db
      .select({ current: sql<number>`max(${treeVersion.version})` })
      .from(treeVersion);

    const rows = await db
      .select({ id: areas.id, parentId: areas.parentId, name: areas.name })
      .from(areas);
    const bounds = computeAreaBounds(rows);

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

export type NewAreaRow = {
  parentId: number | null;
  name: string;
  description: string | null;
};

/** Inserts a new area at its final nested-set position synchronously — no
 * pending lft=0/rght=0 window — by splicing a two-number slot into the
 * number line: every area at or right of the insertion point shifts up by
 * 2 (climbs mirror their area's bounds, so they shift identically), and
 * the new leaf takes `(insertAt, insertAt + 1)`. The shifts and the insert
 * commit in one atomic db.batch, guarded by the same tree_version claim
 * recomputeAreaTree uses: a concurrent splice or full recompute that
 * committed since this attempt's reads makes the claim's INSERT hit a
 * primary-key conflict, rolling the whole batch back to retry against
 * fresh bounds — so stale insertion points never reach the tree. Gaps left
 * by deleteArea are harmless here for the same reason they're harmless to
 * leave: shifting preserves relative order and containment regardless.
 *
 * The insertion point follows computeAreaBounds's name-sorted sibling
 * order (before the first name-greater sibling, else appended as the last
 * child / rightmost root), so a later full recompute reproduces the same
 * ordering instead of reshuffling.
 *
 * One legacy escape hatch: a parent still at the seed pipeline's 0/0
 * placeholder (only possible when seeded data hasn't been reindexed yet)
 * has no slot to splice into, so the new area is inserted with the same
 * placeholder convention and a full recompute runs before returning. */
export async function insertAreaIntoTree(db: Database, input: NewAreaRow): Promise<number> {
  let lastConflict: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Version first, bounds second — see the matching read in
    // recomputeAreaTree for why this order is load-bearing.
    const [{ current }] = await db
      .select({ current: sql<number>`max(${treeVersion.version})` })
      .from(treeVersion);

    let insertAt: number;
    if (input.parentId != null) {
      const parent = await db
        .select({ lft: areas.lft, rght: areas.rght })
        .from(areas)
        .where(eq(areas.id, input.parentId))
        .get();
      if (!parent) throw new Error(`insertAreaIntoTree: parent area ${input.parentId} not found`);

      if (parent.lft === 0 && parent.rght === 0) {
        const [{ id }] = await db
          .insert(areas)
          .values({ ...input, lft: 0, rght: 0 })
          .returning({ id: areas.id });
        await recomputeAreaTree(db);
        return id;
      }

      // Placeholder (0/0) siblings can't anchor an insertion point — skip
      // them; the recompute that eventually assigns their bounds re-sorts
      // everything anyway.
      const siblings = await db
        .select({ lft: areas.lft, name: areas.name })
        .from(areas)
        .where(and(eq(areas.parentId, input.parentId), gt(areas.lft, 0)))
        .orderBy(asc(areas.lft));
      const nextSibling = siblings.find((s) => s.name.localeCompare(input.name) > 0);
      insertAt = nextSibling ? nextSibling.lft : parent.rght;
    } else {
      const roots = await db
        .select({ lft: areas.lft, name: areas.name })
        .from(areas)
        .where(and(isNull(areas.parentId), gt(areas.lft, 0)))
        .orderBy(asc(areas.lft));
      const nextRoot = roots.find((r) => r.name.localeCompare(input.name) > 0);
      if (nextRoot) {
        insertAt = nextRoot.lft;
      } else {
        // New rightmost root: open a fresh disjoint range past every
        // existing one (max(rght) always belongs to the current rightmost
        // root, since ranges nest). Placeholder 0/0 rows don't affect max.
        const [{ maxRght }] = await db
          .select({ maxRght: sql<number | null>`max(${areas.rght})` })
          .from(areas);
        insertAt = (maxRght ?? 0) + 1;
      }
    }

    try {
      const [, , , , , inserted] = await db.batch([
        db.insert(treeVersion).values({ version: (current ?? 0) + 1 }),
        db
          .update(areas)
          .set({ lft: sql`${areas.lft} + 2` })
          .where(gte(areas.lft, insertAt)),
        db
          .update(areas)
          .set({ rght: sql`${areas.rght} + 2` })
          .where(gte(areas.rght, insertAt)),
        db
          .update(climbs)
          .set({ lft: sql`${climbs.lft} + 2` })
          .where(gte(climbs.lft, insertAt)),
        db
          .update(climbs)
          .set({ rght: sql`${climbs.rght} + 2` })
          .where(gte(climbs.rght, insertAt)),
        db
          .insert(areas)
          .values({ ...input, lft: insertAt, rght: insertAt + 1 })
          .returning({ id: areas.id }),
      ]);
      return inserted[0].id;
    } catch (err) {
      if (!isVersionConflict(err)) throw err;
      lastConflict = err;
      if (attempt < MAX_ATTEMPTS) await sleep(10 * attempt + Math.random() * 20);
    }
  }

  // Unlike recomputeAreaTree (which another run can safely redo later),
  // giving up here means the area was never created — surface it so the
  // action boundary reports a failure instead of a phantom success.
  throw new Error(
    `insertAreaIntoTree: gave up after ${MAX_ATTEMPTS} attempts, still losing the tree_version race: ${String(lastConflict)}`,
  );
}
