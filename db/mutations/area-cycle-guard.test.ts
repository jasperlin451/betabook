import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createDb, type Database } from "@/db/client";
import { areas } from "@/db/schema";
import { getAncestors, getSubtreeClimbs, findClimbsByNameAndArea } from "@/db/queries";
import { seedFixtureTree } from "@/test/fixtures";

/** Every subtree and ancestor query in db/queries walks parent_id through a
 * recursive CTE with UNION ALL, which doesn't dedup. Those walks terminate
 * only because the tree is acyclic — one cyclic parent_id edge turns an
 * unbounded walk into an infinite one and the query burns until D1's 30s
 * limit kills it. There is no read-side defense and deliberately so: adding
 * UNION everywhere would pay a dedup cost on every page load to guard against
 * a state the data should never be in.
 *
 * So the guarantee has to hold at write time, which is what
 * drizzle/migrations/0017_area_cycle_guard.sql enforces and what these tests
 * pin. They exercise the triggers through raw statements rather than through
 * db/mutations/areas.ts, because the point of putting the check in the
 * database is that it binds writers that don't go through the mutations at
 * all — an import script, a manual fix-up, a future action.
 *
 * Note what can't be tested here: that an actual cycle hangs the readers.
 * Asserting it would mean committing one, and the assertion would be a test
 * that never finishes. The rejection cases below are the reproduction. */

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);
});

/** Fixture tree: Test Crag (1) > Test Boulders (2) > {Test Highball Alcove
 * (4), Test Slab Area (5)}, and Test Crag (1) > Test Sport Wall (3). */
const TEST_CRAG = 1;
const TEST_BOULDERS = 2;
const TEST_SPORT_WALL = 3;
const TEST_HIGHBALL_ALCOVE = 4;

/** Asserts a statement was rejected by the cycle trigger specifically, rather
 * than by a foreign key, a PK conflict, or anything else that also fails.
 *
 * Drizzle wraps driver errors in a DrizzleQueryError whose own message is just
 * the failing SQL — the trigger's message and SQLITE_CONSTRAINT_TRIGGER live
 * two levels down the `cause` chain, so matching the top-level message would
 * pass for any failure at all. */
async function expectCycleRejection(statement: Promise<unknown>) {
  const error = await statement.then(
    () => {
      throw new Error("expected the cycle guard to reject this statement, but it succeeded");
    },
    (err: unknown) => err,
  );

  const chain: string[] = [];
  for (let cur = error; cur instanceof Error; cur = cur.cause) chain.push(cur.message);

  expect(chain.join(" | ")).toMatch(/area parent_id would create a cycle/);
  expect(chain.join(" | ")).toMatch(/SQLITE_CONSTRAINT_TRIGGER/);
}

describe("the database rejects any parent_id write that closes a cycle", () => {
  it("rejects an area that is its own parent", async () => {
    await expectCycleRejection(
      db.insert(areas).values({ id: 9001, parentId: 9001, name: "Ouroboros" }),
    );

    expect(await db.select().from(areas).where(eq(areas.id, 9001)).get()).toBeUndefined();
  });

  it("rejects reparenting an area onto itself", async () => {
    await expectCycleRejection(
      db.update(areas).set({ parentId: TEST_BOULDERS }).where(eq(areas.id, TEST_BOULDERS)),
    );
  });

  it("rejects reparenting an area under its own child", async () => {
    await expectCycleRejection(
      db.update(areas).set({ parentId: TEST_BOULDERS }).where(eq(areas.id, TEST_CRAG)),
    );
  });

  it("rejects reparenting an area under a deeper descendant, not just a direct child", async () => {
    // Test Crag (1) > Test Boulders (2) > Test Highball Alcove (4): two levels
    // down, so catching this needs the full ancestor walk, not a parent check.
    await expectCycleRejection(
      db.update(areas).set({ parentId: TEST_HIGHBALL_ALCOVE }).where(eq(areas.id, TEST_CRAG)),
    );
  });

  it("leaves the tree untouched after a rejected write", async () => {
    await expectCycleRejection(
      db.update(areas).set({ parentId: TEST_HIGHBALL_ALCOVE }).where(eq(areas.id, TEST_CRAG)),
    );

    // RAISE(ABORT) rolls the statement back rather than leaving it half
    // applied, so the ancestor walk that the rejected edge would have looped
    // still terminates and still returns the original chain.
    const crag = await db.select().from(areas).where(eq(areas.id, TEST_CRAG)).get();
    expect(crag?.parentId).toBeNull();

    const ancestors = await getAncestors(db, {
      id: TEST_HIGHBALL_ALCOVE,
      parentId: TEST_BOULDERS,
      name: "Test Highball Alcove",
      description: null,
    });
    expect(ancestors.map((a) => a.id)).toEqual([TEST_CRAG, TEST_BOULDERS]);
  });
});

describe("the guard only blocks cycles, not ordinary tree writes", () => {
  it("allows a normal child insert", async () => {
    await db.insert(areas).values({ id: 9010, parentId: TEST_SPORT_WALL, name: "Guard Child" });
    const row = await db.select().from(areas).where(eq(areas.id, 9010)).get();
    expect(row?.parentId).toBe(TEST_SPORT_WALL);
  });

  it("allows a root insert, where parent_id is null", async () => {
    await db.insert(areas).values({ id: 9011, parentId: null, name: "Guard Root" });
    const row = await db.select().from(areas).where(eq(areas.id, 9011)).get();
    expect(row?.parentId).toBeNull();
  });

  it("allows an acyclic reparent — the guard is a cycle check, not immutability", async () => {
    await db.insert(areas).values({ id: 9012, parentId: TEST_SPORT_WALL, name: "Guard Mover" });
    await db.update(areas).set({ parentId: TEST_BOULDERS }).where(eq(areas.id, 9012));

    const row = await db.select().from(areas).where(eq(areas.id, 9012)).get();
    expect(row?.parentId).toBe(TEST_BOULDERS);
  });

  it("allows a child whose id is lower than its parent's", async () => {
    // getSubtreeClimbs's large-subtree test seeds exactly this shape, and it's
    // legal: createArea only requires the parent to exist, and an explicit id
    // needn't follow insertion order. Worth pinning because the cheaper guard
    // this migration passed over — CHECK (parent_id < id), which also makes
    // cycles impossible — would reject it.
    await db.insert(areas).values({ id: 9100, parentId: null, name: "Guard High Root" });
    await db.insert(areas).values({ id: 9099, parentId: 9100, name: "Guard Low Child" });

    const row = await db.select().from(areas).where(eq(areas.id, 9099)).get();
    expect(row?.parentId).toBe(9100);
  });

  it("does not fire on updates that leave parent_id alone", async () => {
    // The UPDATE trigger is scoped to `UPDATE OF parent_id`, so a rename
    // doesn't pay for an ancestor walk.
    await db.update(areas).set({ name: "Guard Child Renamed" }).where(eq(areas.id, 9010));
    const row = await db.select().from(areas).where(eq(areas.id, 9010)).get();
    expect(row?.name).toBe("Guard Child Renamed");
  });
});

describe("the readers that depend on the invariant", () => {
  it("keeps the subtree and ancestor walks terminating over the guarded tree", async () => {
    // Both directions of the UNION ALL walk the guard protects: down
    // (subtreeAreaIds) and up (findClimbsByNameAndArea, the import lookup).
    const crag = await db.select().from(areas).where(eq(areas.id, TEST_CRAG)).get();
    const { climbs } = await getSubtreeClimbs(db, crag!);
    expect(climbs.length).toBeGreaterThan(0);

    const found = await findClimbsByNameAndArea(db, "Test Highball", "Test Crag");
    expect(found.map((c) => c.id)).toEqual([1]);
  });

  it("has no cyclic edge anywhere in the table", async () => {
    // The invariant stated directly, over whatever every other test in this
    // file left behind. UNION (not UNION ALL) so this check terminates even
    // if it is about to fail.
    const rows = await db.all<{ id: number }>(sql`
      WITH RECURSIVE reachable(root_id, id) AS (
        SELECT id, parent_id FROM areas WHERE parent_id IS NOT NULL
        UNION
        SELECT reachable.root_id, areas.parent_id FROM reachable
        JOIN areas ON areas.id = reachable.id
        WHERE areas.parent_id IS NOT NULL
      )
      SELECT root_id AS id FROM reachable WHERE root_id = id
    `);
    expect(rows).toEqual([]);
  });
});
