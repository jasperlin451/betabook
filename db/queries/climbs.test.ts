import { env } from "cloudflare:test";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import { areas, climbs } from "@/db/schema";
import { getArea } from "./areas";
import {
  countSearchClimbs,
  findClimbsByNameAndArea,
  getClimb,
  getSubtreeClimbs,
  getSubtreeGradeHistogram,
  hasClimbsInArea,
  searchClimbs,
} from "./climbs";
import {
  seedFixtureSend,
  seedFixtureTree,
  seedFixtureUser,
  seedManyAreas,
  seedManyClimbs,
} from "@/test/fixtures";

// getSubtreeClimbs forces climbs_lft_rght_idx below LARGE_AREA_SUBTREE_SPAN
// (see climbs.ts) — this fixture tree's spans are tiny, so it always takes
// that path; climbs.large-area.test.ts covers the other (sort-index) path.

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);
});

describe("getClimb", () => {
  it("returns the climb for a known id", async () => {
    const climb = await getClimb(db, 1);
    expect(climb?.name).toBe("Test Highball");
  });

  it("returns undefined for an unknown id", async () => {
    const climb = await getClimb(db, 999999);
    expect(climb).toBeUndefined();
  });
});

describe("hasClimbsInArea", () => {
  it("returns true for an area with climbs directly in it", async () => {
    expect(await hasClimbsInArea(db, 3)).toBe(true); // Test Sport Wall
  });

  it("returns false for an area with no climbs of its own, even if its sub-areas have some", async () => {
    expect(await hasClimbsInArea(db, 2)).toBe(false); // Test Boulders — climbs live on its children
  });

  it("returns false for a leaf area with no climbs", async () => {
    expect(await hasClimbsInArea(db, 1)).toBe(false); // Test Crag itself has no direct climbs
  });
});

describe("getSubtreeClimbs", () => {
  it("returns every climb in the full subtree, not just direct climbs", async () => {
    const root = await getArea(db, 1);
    const { climbs } = await getSubtreeClimbs(db, root!);
    expect(climbs.map((c) => c.name).sort()).toEqual([
      "Test Crack",
      "Test Crimper",
      "Test Highball",
      "Test Slab",
    ]);
  });

  it("finds climbs attached only to descendants, for an area with no direct climbs", async () => {
    const boulders = await getArea(db, 2);
    const { climbs } = await getSubtreeClimbs(db, boulders!);
    expect(climbs.map((c) => c.name).sort()).toEqual(["Test Highball", "Test Slab"]);
  });

  it("finds climbs directly attached to a leaf area", async () => {
    const sportWall = await getArea(db, 3);
    const { climbs } = await getSubtreeClimbs(db, sportWall!);
    expect(climbs.map((c) => c.name).sort()).toEqual(["Test Crack", "Test Crimper"]);
  });

  describe("sort", () => {
    beforeAll(async () => {
      // A user can only send a given climb once (sends.user_id/climb_id is
      // unique), so each send below needs its own distinct user.
      for (let i = 1; i <= 6; i++) {
        await seedFixtureUser(db, { id: `test-user-climbs-sort-${i}`, name: `Climbs Sort Tester ${i}` });
      }

      // Test Slab (climb 2): 2 sends, ratings 5 and 3 -> avg 4.
      await seedFixtureSend(db, {
        userId: "test-user-climbs-sort-1",
        climbId: 2,
        dateSent: "2026-01-01",
        rating: 5,
      });
      await seedFixtureSend(db, {
        userId: "test-user-climbs-sort-2",
        climbId: 2,
        dateSent: "2026-01-02",
        rating: 3,
      });
      // Test Highball (climb 1): 1 send, no rating.
      await seedFixtureSend(db, {
        userId: "test-user-climbs-sort-3",
        climbId: 1,
        dateSent: "2026-01-03",
      });
      // Test Crimper (climb 3): 3 sends, only one rated (1).
      await seedFixtureSend(db, {
        userId: "test-user-climbs-sort-4",
        climbId: 3,
        dateSent: "2026-01-04",
      });
      await seedFixtureSend(db, {
        userId: "test-user-climbs-sort-5",
        climbId: 3,
        dateSent: "2026-01-05",
      });
      await seedFixtureSend(db, {
        userId: "test-user-climbs-sort-6",
        climbId: 3,
        dateSent: "2026-01-06",
        rating: 1,
      });
      // Test Crack (climb 4): no sends at all.
    });

    it("sorts alphabetically by name ascending", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "name_asc");
      expect(climbs.map((c) => c.name)).toEqual([
        "Test Crack",
        "Test Crimper",
        "Test Highball",
        "Test Slab",
      ]);
    });

    it("sorts alphabetically by name descending", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "name_desc");
      expect(climbs.map((c) => c.name)).toEqual([
        "Test Slab",
        "Test Highball",
        "Test Crimper",
        "Test Crack",
      ]);
    });

    it("sorts by grade ascending", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "grade_asc");
      expect(climbs.map((c) => c.name)).toEqual([
        "Test Slab", // grade 2
        "Test Highball", // grade 5
        "Test Crack", // grade 6
        "Test Crimper", // grade 10
      ]);
    });

    it("sorts by grade descending", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "grade_desc");
      expect(climbs.map((c) => c.name)).toEqual([
        "Test Crimper",
        "Test Crack",
        "Test Highball",
        "Test Slab",
      ]);
    });

    it("sorts by rating ascending, with unrated climbs last (tie-broken by id)", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "rating_asc");
      expect(climbs.map((c) => c.name)).toEqual([
        "Test Crimper", // avg 1
        "Test Slab", // avg 4
        "Test Highball", // unrated (id 1)
        "Test Crack", // unrated, no sends at all (id 4)
      ]);
    });

    it("sorts by rating descending, with unrated climbs last (tie-broken by id)", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "rating_desc");
      expect(climbs.map((c) => c.name)).toEqual([
        "Test Slab", // avg 4
        "Test Crimper", // avg 1
        "Test Highball",
        "Test Crack",
      ]);
    });

    it("sorts by ascent count ascending, treating no sends as zero (not last-via-null)", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_asc");
      expect(climbs.map((c) => c.name)).toEqual([
        "Test Crack", // 0 sends
        "Test Highball", // 1 send
        "Test Slab", // 2 sends
        "Test Crimper", // 3 sends
      ]);
    });

    it("sorts by ascent count descending — the page's default sort", async () => {
      const root = await getArea(db, 1);
      const explicit = await getSubtreeClimbs(db, root!, 1, "ascents_desc");
      const usingDefault = await getSubtreeClimbs(db, root!);
      const expected = ["Test Crimper", "Test Slab", "Test Highball", "Test Crack"];
      expect(explicit.climbs.map((c) => c.name)).toEqual(expected);
      expect(usingDefault.climbs.map((c) => c.name)).toEqual(expected);
    });

    it("uses the lft/rght range index, not the sort-column index, for a small area", async () => {
      const root = await getArea(db, 1);
      const plan = await db.all<{ detail: string }>(sql`
        EXPLAIN QUERY PLAN
        SELECT climbs.id FROM climbs INDEXED BY climbs_lft_rght_idx
        WHERE climbs.lft >= ${root!.lft} AND climbs.lft <= ${root!.rght} AND climbs.rght <= ${root!.rght}
        ORDER BY climbs.send_count DESC, climbs.id
        LIMIT 51 OFFSET 0
      `);
      expect(plan.some((row) => row.detail.includes("climbs_lft_rght_idx"))).toBe(true);
    });
  });

  describe("filter", () => {
    // Test Highball: boulder, grade 5. Test Slab: boulder, grade 2.
    // Test Crimper: sport, grade 10. Test Crack: trad, grade 6.
    it("returns every climb when no disciplines are checked", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", { disciplines: [] });
      expect(climbs.map((c) => c.name).sort()).toEqual([
        "Test Crack",
        "Test Crimper",
        "Test Highball",
        "Test Slab",
      ]);
    });

    it("filters down to a single checked discipline", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: ["boulder"],
        boulderRange: [0, 20],
      });
      expect(climbs.map((c) => c.name).sort()).toEqual(["Test Highball", "Test Slab"]);
    });

    it("excludes climbs outside the checked discipline's grade range", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: ["boulder"],
        boulderRange: [0, 3],
      });
      expect(climbs.map((c) => c.name)).toEqual(["Test Slab"]);
    });

    it("filters by multiple disciplines independently, excluding the unchecked one", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: ["boulder", "trad"],
        boulderRange: [0, 20],
        tradRange: [0, 20],
      });
      expect(climbs.map((c) => c.name).sort()).toEqual(["Test Crack", "Test Highball", "Test Slab"]);
    });

    it("fuzzy-matches by partial climb name", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: [],
        name: "Crim",
      });
      expect(climbs.map((c) => c.name)).toEqual(["Test Crimper"]);
    });

    it("combines a name search with a discipline/grade filter", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: ["boulder"],
        boulderRange: [0, 20],
        name: "Test",
      });
      expect(climbs.map((c) => c.name).sort()).toEqual(["Test Highball", "Test Slab"]);
    });

    it("returns nothing when the name matches no climb", async () => {
      const root = await getArea(db, 1);
      const { climbs, hasNextPage } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: [],
        name: "NoSuchClimbNameAtAll",
      });
      expect(climbs).toEqual([]);
      expect(hasNextPage).toBe(false);
    });

    // Reuses the ratings/ascent counts seeded in the "sort" describe above:
    // Slab (2 sends, avg 4), Highball (1 send, unrated), Crimper (3 sends,
    // avg 1), Crack (0 sends, unrated).
    it("filters by minimum ascent count", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: [],
        minAscents: 2,
      });
      expect(climbs.map((c) => c.name).sort()).toEqual(["Test Crimper", "Test Slab"]);
    });

    it("filters by rating range, excluding unrated climbs and climbs outside the range", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: [],
        ratingRange: [3, 5],
      });
      expect(climbs.map((c) => c.name)).toEqual(["Test Slab"]);
    });

    it("treats the default rating range as no filter at all, keeping unrated climbs", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: [],
        ratingRange: [0, 5],
      });
      expect(climbs).toHaveLength(4);
    });

    it('returns every climb for an "Any"–"Any" rating range (0 = unbounded), not zero results', async () => {
      // Regression: "Any" as the max used to reach the query as 0, turning
      // the filter into `avg_rating BETWEEN 0 AND 0` — zero results.
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: [],
        ratingRange: [0, 0],
      });
      expect(climbs).toHaveLength(4);
    });

    it('applies only the lower bound when the max is "Any" (0)', async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: [],
        ratingRange: [3, 0],
      });
      expect(climbs.map((c) => c.name)).toEqual(["Test Slab"]); // avg 4
    });

    it('applies only the upper bound when the min is "Any" (0), still excluding unrated climbs', async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: [],
        ratingRange: [0, 3],
      });
      expect(climbs.map((c) => c.name)).toEqual(["Test Crimper"]); // avg 1
    });

    it("combines a min-ascents filter with a discipline filter", async () => {
      const root = await getArea(db, 1);
      const { climbs } = await getSubtreeClimbs(db, root!, 1, "ascents_desc", {
        disciplines: ["boulder"],
        boulderRange: [0, 20],
        minAscents: 2,
      });
      expect(climbs.map((c) => c.name)).toEqual(["Test Slab"]);
    });
  });
});

describe("getSubtreeGradeHistogram", () => {
  // Fixture grades: Test Highball boulder/5, Test Slab boulder/2,
  // Test Crimper sport/10, Test Crack trad/6 — all under root area 1.
  it("counts climbs per (type, grade) across the whole subtree", async () => {
    const root = await getArea(db, 1);
    const rows = await getSubtreeGradeHistogram(db, root!);
    const byKey = Object.fromEntries(rows.map((r) => [`${r.type}/${r.grade}`, r.count]));
    expect(byKey["boulder/5"]).toBe(1);
    expect(byKey["boulder/2"]).toBe(1);
    expect(byKey["sport/10"]).toBe(1);
    expect(byKey["trad/6"]).toBe(1);
    expect(rows.reduce((sum, r) => sum + r.count, 0)).toBe(4);
  });

  it("scopes to the given subtree, not the whole table", async () => {
    const sportWall = await getArea(db, 3); // holds Test Crimper + Test Crack
    const rows = await getSubtreeGradeHistogram(db, sportWall!);
    expect(rows.sort((a, b) => a.type.localeCompare(b.type))).toEqual([
      { type: "sport", grade: 10, count: 1 },
      { type: "trad", grade: 6, count: 1 },
    ]);
  });

  it("uses the lft/rght range index", async () => {
    const root = await getArea(db, 1);
    const plan = await db.all<{ detail: string }>(sql`
      EXPLAIN QUERY PLAN
      SELECT climbs.type, climbs.grade, COUNT(*)
      FROM climbs INDEXED BY climbs_lft_rght_idx
      WHERE climbs.lft >= ${root!.lft} AND climbs.lft <= ${root!.rght} AND climbs.rght <= ${root!.rght}
      GROUP BY climbs.type, climbs.grade
    `);
    expect(plan.some((row) => row.detail.includes("climbs_lft_rght_idx"))).toBe(true);
  });
});

describe("searchClimbs", () => {
  it("matches by climb name", async () => {
    const { climbs } = await searchClimbs(db, { name: "Crimper", disciplines: [] });
    expect(climbs.map((c) => c.name)).toEqual(["Test Crimper"]);
  });

  it("fuzzy-matches by partial climb name", async () => {
    const { climbs } = await searchClimbs(db, { name: "Crim", disciplines: [] });
    expect(climbs.map((c) => c.name)).toEqual(["Test Crimper"]);
  });

  it("matches by area name against the climb's own area or any ancestor", async () => {
    // "Test Boulders" is an ancestor of the climbs' actual areas (the alcove/slab
    // sub-areas), not their direct area — this is the nested-set ancestor match.
    const { climbs } = await searchClimbs(db, { areaName: "Boulders", disciplines: [] });
    expect(climbs.map((c) => c.name).sort()).toEqual(["Test Highball", "Test Slab"]);
  });

  it("returns an empty page when the area name matches nothing", async () => {
    const results = await searchClimbs(db, {
      areaName: "NoSuchAreaNameAtAll",
      disciplines: [],
    });
    expect(results).toEqual({ climbs: [], hasNextPage: false });
  });

  it("returns an empty page when the name has no matchable tokens", async () => {
    const results = await searchClimbs(db, { name: " ", disciplines: [] });
    expect(results).toEqual({ climbs: [], hasNextPage: false });
  });

  it("filters by a single discipline's grade range", async () => {
    const { climbs } = await searchClimbs(db, {
      disciplines: ["boulder"],
      boulderRange: [5, 5],
    });
    expect(climbs.map((c) => c.name)).toEqual(["Test Highball"]);
  });

  it("filters by both disciplines independently without interleaving", async () => {
    const { climbs } = await searchClimbs(db, {
      disciplines: ["boulder", "trad"],
      boulderRange: [5, 5],
      tradRange: [6, 6],
    });
    expect(climbs.map((c) => c.name).sort()).toEqual(["Test Crack", "Test Highball"]);
  });

  it("filters sport and trad independently by their own grade ranges", async () => {
    const { climbs } = await searchClimbs(db, {
      disciplines: ["sport", "trad"],
      sportRange: [10, 10],
      tradRange: [0, 0],
    });
    expect(climbs.map((c) => c.name)).toEqual(["Test Crimper"]);
  });

  it("excludes climbs outside the requested grade range", async () => {
    const { climbs } = await searchClimbs(db, {
      disciplines: ["boulder"],
      boulderRange: [0, 3],
    });
    expect(climbs.map((c) => c.name)).toEqual(["Test Slab"]);
  });

  it("returns a real numeric areaId, not the raw snake_case column", async () => {
    // Regression test: a raw-SQL `climbs.*` wildcard returns SQLite's actual
    // column name (`area_id`), not drizzle's camelCase `areaId` field — that
    // silently produced `undefined` here until the query explicitly aliased
    // every column.
    const { climbs } = await searchClimbs(db, { name: "Test Highball", disciplines: [] });
    expect(climbs).toHaveLength(1);
    expect(climbs[0].areaId).toBe(4); // Test Highball Alcove
  });

  // Reuses the ratings/ascent counts seeded in getSubtreeClimbs's "sort"
  // describe above: Slab (2 sends, avg 4), Highball (1 send, unrated),
  // Crimper (3 sends, avg 1), Crack (0 sends, unrated).
  it("filters by minimum ascent count", async () => {
    const { climbs } = await searchClimbs(db, { disciplines: [], minAscents: 2 });
    expect(climbs.map((c) => c.name).sort()).toEqual(["Test Crimper", "Test Slab"]);
  });

  it("filters by rating range, excluding unrated climbs and climbs outside the range", async () => {
    const { climbs } = await searchClimbs(db, { disciplines: [], ratingRange: [3, 5] });
    expect(climbs.map((c) => c.name)).toEqual(["Test Slab"]);
  });

  it('returns every climb for an "Any"–"Any" rating range (0 = unbounded), not zero results', async () => {
    // Same regression as getSubtreeClimbs: an "Any" max used to become
    // `avg_rating BETWEEN 0 AND 0` and match nothing.
    const { climbs } = await searchClimbs(db, { disciplines: [], ratingRange: [0, 0] });
    expect(climbs.map((c) => c.name).sort()).toEqual([
      "Test Crack",
      "Test Crimper",
      "Test Highball",
      "Test Slab",
    ]);
  });

  it('applies only the lower bound when the max is "Any" (0)', async () => {
    const { climbs } = await searchClimbs(db, { disciplines: [], ratingRange: [3, 0] });
    expect(climbs.map((c) => c.name)).toEqual(["Test Slab"]); // avg 4
  });

  it("defaults to sorting by ascent count descending", async () => {
    const { climbs } = await searchClimbs(db, { disciplines: [] });
    expect(climbs.map((c) => c.name)).toEqual([
      "Test Crimper", // 3 ascents
      "Test Slab", // 2 ascents
      "Test Highball", // 1 ascent
      "Test Crack", // 0 ascents
    ]);
  });

  it("sorts by an explicit field", async () => {
    const { climbs } = await searchClimbs(db, { disciplines: [], sort: "name_asc" });
    expect(climbs.map((c) => c.name)).toEqual([
      "Test Crack",
      "Test Crimper",
      "Test Highball",
      "Test Slab",
    ]);
  });

  it("doesn't choke when an area name matches far more areas than one statement's bound-parameter limit allows", async () => {
    // Regression test: area-name matching used to build one
    // `(lft >= ? AND rght <= ?)` OR-clause per matched area, so a name
    // matching many areas blew past D1's per-statement bound-parameter
    // limit ("Failed query" at runtime). It's now a single correlated
    // EXISTS subquery, so this must succeed regardless of match count.
    const AREA_COUNT = 60;
    const startId = 90_000;
    await seedManyAreas(db, AREA_COUNT, startId);

    const climbRows = Array.from({ length: AREA_COUNT }, (_, i) => ({
      id: startId + i,
      areaId: startId + i,
      name: `Bulk Climb For Area ${i}`,
      type: "boulder" as const,
      grade: i % 19,
    }));
    // 10 bound columns per row now (drizzle binds every defaulted column
    // explicitly), so a smaller chunk stays under D1's bound-parameter limit.
    const CHUNK_SIZE = 10;
    for (let i = 0; i < climbRows.length; i += CHUNK_SIZE) {
      await db.insert(climbs).values(climbRows.slice(i, i + CHUNK_SIZE));
    }
    await db.run(
      sql`INSERT INTO climbs_fts(rowid, name) SELECT id, name FROM climbs WHERE id >= ${startId}`,
    );

    // searchClimbs returns one SEARCH_PAGE_SIZE page at a time — the point
    // here is that the query doesn't throw with 60 areas matched, not that
    // every match comes back at once.
    const { climbs: results, hasNextPage } = await searchClimbs(db, {
      areaName: "Bulk Area",
      disciplines: [],
    });
    expect(results).toHaveLength(25);
    expect(hasNextPage).toBe(true);
  });
});

// Placed after the searchClimbs describe: this seeds its own area with 55
// more climbs, which would otherwise bleed into the exact result sets above.
describe("searchClimbs pagination", () => {
  const AREA_ID = 200_000;
  // Scopes every query here to just this describe's fixtures — a name unique
  // in this file, matched via areaNameCondition.
  const SCOPE = { areaName: "Paged Search Area", disciplines: [] as [] };

  beforeAll(async () => {
    // lft/rght range chosen not to overlap any other fixture's nested-set
    // span (seedManyAreas uses 100_000+).
    await db.insert(areas).values({
      id: AREA_ID,
      parentId: null,
      lft: 400_000,
      rght: 400_001,
      name: "Paged Search Area",
    });
    await db.run(sql`INSERT INTO areas_fts(rowid, name) VALUES (${AREA_ID}, 'Paged Search Area')`);
    await seedManyClimbs(db, AREA_ID, 55, AREA_ID);
  });

  it("returns a full page and reports hasNextPage when more rows remain", async () => {
    const page1 = await searchClimbs(db, SCOPE, 1);
    expect(page1.climbs).toHaveLength(25);
    expect(page1.hasNextPage).toBe(true);
  });

  it("returns the remainder and reports no next page on the last page", async () => {
    const page3 = await searchClimbs(db, SCOPE, 3);
    expect(page3.climbs).toHaveLength(5);
    expect(page3.hasNextPage).toBe(false);
  });

  // Every seeded climb has send_count 0 (default-sort tie) and grades of
  // `i % 19` (~3 climbs per grade) — exactly the tie-heavy shapes where a
  // missing unique tie-breaker (`climbs.id`) makes OFFSET pagination
  // duplicate or skip rows across pages.
  it("pages over fully tied climbs without duplicating or skipping any", async () => {
    for (const sort of [undefined, "grade_asc"] as const) {
      const ids: number[] = [];
      for (let page = 1; page <= 3; page++) {
        const result = await searchClimbs(db, { ...SCOPE, sort }, page);
        ids.push(...result.climbs.map((c) => c.id));
      }
      expect(ids).toHaveLength(55);
      expect(new Set(ids).size).toBe(55);
    }
  });

  it("counts every match, not just the first page", async () => {
    expect(await countSearchClimbs(db, SCOPE)).toBe(55);
  });

  it("counts with the same filters as the page query", async () => {
    // Grades are i % 19 over 55 climbs: each grade in [0, 4] appears 3
    // times, so a boulder range of [0, 4] matches 15.
    expect(
      await countSearchClimbs(db, {
        ...SCOPE,
        disciplines: ["boulder"],
        boulderRange: [0, 4],
      }),
    ).toBe(15);
  });

  it("counts zero for a name with no matchable tokens", async () => {
    expect(await countSearchClimbs(db, { name: " ", disciplines: [] })).toBe(0);
  });
});

describe("findClimbsByNameAndArea", () => {
  it("matches a climb by its own direct area", async () => {
    const results = await findClimbsByNameAndArea(db, "Test Crimper", "Test Sport Wall");
    expect(results.map((c) => c.name)).toEqual(["Test Crimper"]);
  });

  it("matches a climb via an ancestor area name", async () => {
    // Test Highball lives in Test Highball Alcove, whose ancestor is Test Boulders.
    const results = await findClimbsByNameAndArea(db, "Test Highball", "Test Boulders");
    expect(results.map((c) => c.name)).toEqual(["Test Highball"]);
  });

  it("is case-insensitive and trims whitespace on both name and area", async () => {
    const results = await findClimbsByNameAndArea(db, "  test crimper  ", "  TEST SPORT WALL  ");
    expect(results.map((c) => c.name)).toEqual(["Test Crimper"]);
  });

  it("returns an empty array when the climb name doesn't match", async () => {
    const results = await findClimbsByNameAndArea(db, "No Such Climb", "Test Sport Wall");
    expect(results).toEqual([]);
  });

  it("returns an empty array when the area doesn't match (even if the climb name does)", async () => {
    const results = await findClimbsByNameAndArea(db, "Test Crimper", "No Such Area");
    expect(results).toEqual([]);
  });

  it("returns every match when the (name, area) pair is ambiguous", async () => {
    // A second "Test Highball" under a different area, both under Test Crag.
    await db.insert(climbs).values({
      id: 999,
      areaId: 3, // Test Sport Wall
      name: "Test Highball",
      type: "sport",
      grade: 3,
    });

    const results = await findClimbsByNameAndArea(db, "Test Highball", "Test Crag");
    expect(results.map((c) => c.id).sort()).toEqual([1, 999]);
  });
});
