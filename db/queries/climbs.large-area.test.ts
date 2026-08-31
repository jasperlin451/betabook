import { env } from "cloudflare:test";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import { areas, climbs } from "@/db/schema";
import { getArea, type Area } from "./areas";
import { getSubtreeClimbs, type SubtreeClimbsSort } from "./climbs";
import { seedFixtureSend, seedFixtureUser } from "@/test/fixtures";

// getSubtreeClimbs forces a different index (climbs_area_idx vs a per-sort
// index) depending on whether the queried area's subtree clears
// LARGE_AREA_SUBTREE_AREAS — SQLite picks one query plan per SQL *shape*,
// not per call, so this "large area" path is a genuinely different code path
// from climbs.test.ts's small-fixture-tree coverage, not just a bigger
// version of the same query. Seeding 1000+ real sub-areas just to reach the
// threshold would say nothing extra, so every call here passes `largeSubtree`
// to select the branch directly — which is what that parameter is for.

let db: Database;
const AREA_ID = 9000;
const START_ID = 9001;

/** getSubtreeClimbs on the large-subtree branch, whatever the fixture's real size. */
function largeSubtreeClimbs(area: Area, sort: SubtreeClimbsSort = "ascents_desc") {
  return getSubtreeClimbs(db, area, 1, sort, undefined, true);
}

beforeAll(async () => {
  db = createDb(env.DB);
  await db.insert(areas).values({
    id: AREA_ID,
    parentId: null,
    name: "Large Test Region",
  });

  await db.insert(climbs).values([
    { id: START_ID, areaId: AREA_ID, name: "Aardvark Wall", type: "boulder", grade: 5 },
    { id: START_ID + 1, areaId: AREA_ID, name: "Bandit Crack", type: "trad", grade: 2 },
    { id: START_ID + 2, areaId: AREA_ID, name: "Crusher Face", type: "sport", grade: 10 },
    { id: START_ID + 3, areaId: AREA_ID, name: "Driftwood Slab", type: "boulder", grade: null },
  ]);

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
    const { climbs } = await largeSubtreeClimbs(area!);
    expect(climbs.map((c) => c.name)).toEqual([
      "Crusher Face", // 2 sends
      "Aardvark Wall", // 1 send
      "Bandit Crack", // 0 sends (id tie-break before Driftwood Slab)
      "Driftwood Slab", // 0 sends
    ]);
  });

  it("sorts by ascent count ascending", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await largeSubtreeClimbs(area!, "ascents_asc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Bandit Crack",
      "Driftwood Slab",
      "Aardvark Wall",
      "Crusher Face",
    ]);
  });

  it("sorts by rating descending, with unrated climbs last", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await largeSubtreeClimbs(area!, "rating_desc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Crusher Face", // avg 4
      "Aardvark Wall",
      "Bandit Crack",
      "Driftwood Slab",
    ]);
  });

  it("sorts by rating ascending, with unrated climbs last", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await largeSubtreeClimbs(area!, "rating_asc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Crusher Face", // avg 4, the only rated climb
      "Aardvark Wall",
      "Bandit Crack",
      "Driftwood Slab",
    ]);
  });

  it("sorts by grade ascending, with ungraded climbs last", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await largeSubtreeClimbs(area!, "grade_asc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Bandit Crack", // grade 2
      "Aardvark Wall", // grade 5
      "Crusher Face", // grade 10
      "Driftwood Slab", // ungraded
    ]);
  });

  it("sorts by grade descending", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await largeSubtreeClimbs(area!, "grade_desc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Crusher Face",
      "Aardvark Wall",
      "Bandit Crack",
      "Driftwood Slab",
    ]);
  });

  it("sorts alphabetically by name ascending", async () => {
    const area = await getArea(db, AREA_ID);
    const { climbs } = await largeSubtreeClimbs(area!, "name_asc");
    expect(climbs.map((c) => c.name)).toEqual([
      "Aardvark Wall",
      "Bandit Crack",
      "Crusher Face",
      "Driftwood Slab",
    ]);
  });

  it("rejects a sort value with no matching index instead of inlining it into SQL", async () => {
    const area = await getArea(db, AREA_ID);
    await expect(
      largeSubtreeClimbs(area!, "not_a_real_sort" as never),
    ).rejects.toThrow("Invalid sort value");
  });

  // The guard has to hold on the small-subtree branch too: that branch's
  // index name is a constant, so only checking the resolved name would let an
  // unknown sort through to the ORDER BY.
  it("rejects a sort value on the small-subtree branch as well", async () => {
    const area = await getArea(db, AREA_ID);
    await expect(
      getSubtreeClimbs(db, area!, 1, "not_a_real_sort" as never, undefined, false),
    ).rejects.toThrow("Invalid sort value");
  });

  it("the query plan uses the sort-column index, not a full sort of the subtree", async () => {
    const plan = await db.all<{ detail: string }>(sql`
      EXPLAIN QUERY PLAN
      WITH RECURSIVE subtree(id) AS (
        SELECT ${AREA_ID}
        UNION ALL
        SELECT a.id FROM areas a JOIN subtree s ON a.parent_id = s.id
      )
      SELECT climbs.id FROM climbs INDEXED BY climbs_send_count_desc_idx
      JOIN areas ON areas.id = climbs.area_id
      WHERE climbs.area_id IN (SELECT id FROM subtree)
      ORDER BY climbs.send_count DESC, climbs.id
      LIMIT 51 OFFSET 0
    `);
    const details = plan.map((row) => row.detail);
    // Scanning the sort index in order, so no sort step and no early stop lost.
    expect(details.some((d) => d.includes("climbs_send_count_desc_idx"))).toBe(true);
    expect(details.some((d) => d.includes("TEMP B-TREE"))).toBe(false);
    // The subtree walk rides areas_parent_idx rather than scanning areas.
    expect(details.some((d) => d.includes("areas_parent_idx"))).toBe(true);
    // send_count is denormalized onto climbs; `sends` must not be touched.
    expect(details.some((d) => d.toLowerCase().includes("sends"))).toBe(false);
  });
});
