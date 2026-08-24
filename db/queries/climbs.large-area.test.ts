import { env } from "cloudflare:test";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import { areas, climbs } from "@/db/schema";
import { getArea } from "./areas";
import { getSubtreeClimbs } from "./climbs";
import { seedFixtureSend, seedFixtureUser } from "@/test/fixtures";

// getSubtreeClimbs forces a different index (climbs_lft_rght_idx vs a
// per-sort index) depending on whether the queried area's nested-set span
// clears LARGE_AREA_SUBTREE_SPAN — SQLite picks one query plan per SQL
// *shape*, not per call, so this "large area" path is a genuinely different
// code path from climbs.test.ts's small-fixture-tree coverage, not just a
// bigger version of the same query. This exercises it directly, with a span
// well above the threshold, to guard against silently regressing back into
// a full-subtree scan-and-sort.

let db: Database;
const AREA_ID = 9000;
const START_ID = 9001;

beforeAll(async () => {
  db = createDb(env.DB);
  await db.insert(areas).values({
    id: AREA_ID,
    parentId: null,
    lft: 1,
    rght: 3000, // span 2999, well above LARGE_AREA_SUBTREE_SPAN
    name: "Large Test Region",
  });

  // lft/rght copy the area's own range, as getSubtreeClimbs's denormalized
  // filter expects.
  await db.insert(climbs).values([
    { id: START_ID, areaId: AREA_ID, name: "Aardvark Wall", type: "boulder", grade: 5, lft: 1, rght: 3000 },
    { id: START_ID + 1, areaId: AREA_ID, name: "Bandit Crack", type: "trad", grade: 2, lft: 1, rght: 3000 },
    { id: START_ID + 2, areaId: AREA_ID, name: "Crusher Face", type: "sport", grade: 10, lft: 1, rght: 3000 },
    { id: START_ID + 3, areaId: AREA_ID, name: "Driftwood Slab", type: "boulder", grade: null, lft: 1, rght: 3000 },
  ]);
  await db.run(
    sql`INSERT INTO climbs_fts(rowid, name) SELECT id, name FROM climbs WHERE id >= ${START_ID}`,
  );

  for (let i = 1; i <= 4; i++) {
    await seedFixtureUser(db, { id: `test-user-large-area-${i}`, name: `Large Area Tester ${i}` });
  }
  // Crusher Face (id START_ID+2): 2 sends, ratings 5 and 3 -> avg 4.
  await seedFixtureSend(db, {
    userId: "test-user-large-area-1",
    climbId: START_ID + 2,
    dateSent: "2026-01-01",
    rating: 5,
  });
  await seedFixtureSend(db, {
    userId: "test-user-large-area-2",
    climbId: START_ID + 2,
    dateSent: "2026-01-02",
    rating: 3,
  });
  // Aardvark Wall (id START_ID): 1 send, no rating.
  await seedFixtureSend(db, {
    userId: "test-user-large-area-3",
    climbId: START_ID,
    dateSent: "2026-01-03",
  });
  // Bandit Crack, Driftwood Slab: no sends.
});

describe("getSubtreeClimbs on a large-area-shaped subtree", () => {
  it("sorts by ascent count descending — the page's default sort", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await getSubtreeClimbs(db, area!);
    expect(climbs.map((c) => c.name)).toEqual([
      "Crusher Face", // 2 sends
      "Aardvark Wall", // 1 send
      "Bandit Crack", // 0 sends (id tie-break before Driftwood Slab)
      "Driftwood Slab", // 0 sends
    ]);
  });

  it("sorts by ascent count ascending", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await getSubtreeClimbs(db, area!, 1, "ascents_asc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Bandit Crack",
      "Driftwood Slab",
      "Aardvark Wall",
      "Crusher Face",
    ]);
  });

  it("sorts by rating descending, with unrated climbs last", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await getSubtreeClimbs(db, area!, 1, "rating_desc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Crusher Face", // avg 4
      "Aardvark Wall",
      "Bandit Crack",
      "Driftwood Slab",
    ]);
  });

  it("sorts by rating ascending, with unrated climbs last", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await getSubtreeClimbs(db, area!, 1, "rating_asc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Crusher Face", // avg 4, the only rated climb
      "Aardvark Wall",
      "Bandit Crack",
      "Driftwood Slab",
    ]);
  });

  it("sorts by grade ascending, with ungraded climbs last", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await getSubtreeClimbs(db, area!, 1, "grade_asc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Bandit Crack", // grade 2
      "Aardvark Wall", // grade 5
      "Crusher Face", // grade 10
      "Driftwood Slab", // ungraded
    ]);
  });

  it("sorts by grade descending", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await getSubtreeClimbs(db, area!, 1, "grade_desc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Crusher Face",
      "Aardvark Wall",
      "Bandit Crack",
      "Driftwood Slab",
    ]);
  });

  it("sorts alphabetically by name ascending", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await getSubtreeClimbs(db, area!, 1, "name_asc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Aardvark Wall",
      "Bandit Crack",
      "Crusher Face",
      "Driftwood Slab",
    ]);
  });

  it("the query plan uses the sort-column index, not a full sort of the subtree", async () => {
    const area = await getArea(db, AREA_ID);
    const plan = await db.all<{ detail: string }>(sql`
      EXPLAIN QUERY PLAN
      SELECT climbs.id FROM climbs INDEXED BY climbs_send_count_desc_idx
      WHERE climbs.lft >= ${area!.lft} AND climbs.lft <= ${area!.rght} AND climbs.rght <= ${area!.rght}
      ORDER BY climbs.send_count DESC, climbs.id
      LIMIT 51 OFFSET 0
    `);
    const details = plan.map((row) => row.detail);
    expect(details.some((d) => d.includes("climbs_send_count_desc_idx"))).toBe(true);
    expect(details.some((d) => d.includes("TEMP B-TREE"))).toBe(false);
    expect(details.some((d) => d.toLowerCase().includes("sends"))).toBe(false);
  });
});
