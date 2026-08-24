import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import {
  getClimbSendStats,
  getSendsForClimb,
  getSendsForUserPage,
  getUserSendForClimb,
  getUserSendsSummary,
  getUserSentClimbIds,
  type UserSendsFilter,
} from "./sends";
import { seedFixtureSend, seedFixtureTree, seedFixtureUser } from "@/test/fixtures";
import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";

const ALL_SENDS_FILTER: UserSendsFilter = {
  disciplines: ["boulder", "sport", "trad"],
  boulderRange: [0, BOULDER_HUECO.length - 1],
  sportRange: [0, ROPE_YDS.length - 1],
  tradRange: [0, ROPE_YDS.length - 1],
  ascentStyles: [],
  minRating: 0,
};

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);

  await seedFixtureUser(db, { id: "test-user-1", name: "Alice Climber" });
  await seedFixtureUser(db, { id: "test-user-2", name: "Bob Climber" });

  // Test Highball (climb id 1) sent by both users on different dates;
  // Test Slab (climb id 2) sent only by test-user-1.
  await seedFixtureSend(db, {
    userId: "test-user-1",
    climbId: 1,
    dateSent: "2026-01-01",
    rating: 4,
  });
  await seedFixtureSend(db, {
    userId: "test-user-2",
    climbId: 1,
    dateSent: "2026-02-01",
    ascentStyle: "flash",
  });
  await seedFixtureSend(db, {
    userId: "test-user-1",
    climbId: 2,
    dateSent: "2026-03-01",
    ascentStyle: "onsight",
  });
});

describe("getUserSendForClimb", () => {
  it("returns the user's send for a climb they've sent", async () => {
    const send = await getUserSendForClimb(db, "test-user-1", 1);
    expect(send?.rating).toBe(4);
  });

  it("returns undefined when the user hasn't sent that climb", async () => {
    const send = await getUserSendForClimb(db, "test-user-1", 3);
    expect(send).toBeUndefined();
  });
});

describe("getSendsForClimb", () => {
  it("returns every user's send for the climb, newest dateSent first", async () => {
    const results = await getSendsForClimb(db, 1);
    expect(results.map((s) => s.userName)).toEqual(["Bob Climber", "Alice Climber"]);
  });

  it("returns an empty array for a climb with no sends", async () => {
    const results = await getSendsForClimb(db, 3);
    expect(results).toEqual([]);
  });
});

describe("getSendsForUserPage", () => {
  it("returns every send across a user's climbs, newest dateSent first, with area info", async () => {
    const { sends: results, hasMore } = await getSendsForUserPage(
      db,
      "test-user-1",
      ALL_SENDS_FILTER,
      0,
    );
    expect(results.map((s) => s.climbName)).toEqual(["Test Slab", "Test Highball"]);
    expect(results.map((s) => s.areaName)).toEqual(["Test Slab Area", "Test Highball Alcove"]);
    expect(hasMore).toBe(false);
  });

  it("returns an empty page for a user with no sends", async () => {
    await seedFixtureUser(db, { id: "test-user-3", name: "No Sends" });
    const { sends: results, hasMore } = await getSendsForUserPage(
      db,
      "test-user-3",
      ALL_SENDS_FILTER,
      0,
    );
    expect(results).toEqual([]);
    expect(hasMore).toBe(false);
  });

  it("paginates with a page size and reports hasMore", async () => {
    const page1 = await getSendsForUserPage(db, "test-user-1", ALL_SENDS_FILTER, 0, 1);
    expect(page1.sends.map((s) => s.climbName)).toEqual(["Test Slab"]);
    expect(page1.hasMore).toBe(true);

    const page2 = await getSendsForUserPage(db, "test-user-1", ALL_SENDS_FILTER, 1, 1);
    expect(page2.sends.map((s) => s.climbName)).toEqual(["Test Highball"]);
    expect(page2.hasMore).toBe(false);
  });

  it("excludes disciplines not selected", async () => {
    await seedFixtureUser(db, { id: "test-user-5", name: "Multi Discipline" });
    await seedFixtureSend(db, {
      userId: "test-user-5",
      climbId: 1, // Test Highball, boulder
      dateSent: "2026-01-01",
    });
    await seedFixtureSend(db, {
      userId: "test-user-5",
      climbId: 3, // Test Crimper, sport
      dateSent: "2026-02-01",
    });

    const boulderOnly = await getSendsForUserPage(db, "test-user-5", {
      ...ALL_SENDS_FILTER,
      disciplines: ["boulder"],
    }, 0);
    expect(boulderOnly.sends.map((s) => s.climbName)).toEqual(["Test Highball"]);

    const sportOnly = await getSendsForUserPage(db, "test-user-5", {
      ...ALL_SENDS_FILTER,
      disciplines: ["sport"],
    }, 0);
    expect(sportOnly.sends.map((s) => s.climbName)).toEqual(["Test Crimper"]);
  });

  it("returns every discipline when none are selected (unfiltered, not empty)", async () => {
    const results = await getSendsForUserPage(db, "test-user-5", {
      ...ALL_SENDS_FILTER,
      disciplines: [],
    }, 0);
    expect(results.sends.map((s) => s.climbName)).toEqual(["Test Crimper", "Test Highball"]);
  });

  it("filters by grade range within a discipline", async () => {
    // Test Highball is V4 (ordinal 5), Test Slab is V1 (ordinal 2).
    const highOnly = await getSendsForUserPage(db, "test-user-1", {
      ...ALL_SENDS_FILTER,
      boulderRange: [3, BOULDER_HUECO.length - 1],
    }, 0);
    expect(highOnly.sends.map((s) => s.climbName)).toEqual(["Test Highball"]);
  });

  describe("name/areaName filtering", () => {
    beforeAll(async () => {
      await seedFixtureUser(db, { id: "test-user-10", name: "Name Filter Tester" });
      // Test Highball lives in Test Highball Alcove, under Test Boulders,
      // under Test Crag; Test Crimper lives directly in Test Sport Wall,
      // also under Test Crag — a sibling subtree of Test Boulders.
      await seedFixtureSend(db, {
        userId: "test-user-10",
        climbId: 1, // Test Highball
        dateSent: "2026-05-01",
      });
      await seedFixtureSend(db, {
        userId: "test-user-10",
        climbId: 3, // Test Crimper
        dateSent: "2026-05-02",
      });
    });

    it("fuzzy-matches by partial climb name", async () => {
      const results = await getSendsForUserPage(db, "test-user-10", {
        ...ALL_SENDS_FILTER,
        name: "Highb",
      }, 0);
      expect(results.sends.map((s) => s.climbName)).toEqual(["Test Highball"]);
    });

    it("matches by area name against the climb's own area or any ancestor", async () => {
      const results = await getSendsForUserPage(db, "test-user-10", {
        ...ALL_SENDS_FILTER,
        areaName: "Boulders",
      }, 0);
      expect(results.sends.map((s) => s.climbName)).toEqual(["Test Highball"]);
    });

    it("matches every send under a shared top-level ancestor", async () => {
      const results = await getSendsForUserPage(db, "test-user-10", {
        ...ALL_SENDS_FILTER,
        areaName: "Test Crag",
      }, 0);
      expect(results.sends.map((s) => s.climbName).sort()).toEqual(["Test Crimper", "Test Highball"]);
    });

    it("returns no sends when the climb name matches nothing", async () => {
      const results = await getSendsForUserPage(db, "test-user-10", {
        ...ALL_SENDS_FILTER,
        name: "NoSuchClimbNameAtAll",
      }, 0);
      expect(results).toEqual({ sends: [], hasMore: false });
    });

    it("returns no sends when the area name matches nothing", async () => {
      const results = await getSendsForUserPage(db, "test-user-10", {
        ...ALL_SENDS_FILTER,
        areaName: "NoSuchAreaNameAtAll",
      }, 0);
      expect(results).toEqual({ sends: [], hasMore: false });
    });
  });

  describe("sort", () => {
    beforeAll(async () => {
      await seedFixtureUser(db, { id: "test-user-11", name: "Sort Tester" });
      // climbs.grade (ordinal index): Test Slab=2, Test Highball=5,
      // Test Crack=6, Test Crimper=10 — deliberately mixed disciplines,
      // since grade sort is documented as a raw-index sort, not a
      // cross-discipline difficulty comparison.
      await seedFixtureSend(db, {
        userId: "test-user-11",
        climbId: 2, // Test Slab, grade 2
        dateSent: "2026-06-01",
        rating: 3,
      });
      await seedFixtureSend(db, {
        userId: "test-user-11",
        climbId: 3, // Test Crimper, grade 10
        dateSent: "2026-06-02",
        rating: null,
      });
      await seedFixtureSend(db, {
        userId: "test-user-11",
        climbId: 1, // Test Highball, grade 5
        dateSent: "2026-06-03",
        rating: 5,
      });
      await seedFixtureSend(db, {
        userId: "test-user-11",
        climbId: 4, // Test Crack, grade 6
        dateSent: null,
        rating: 1,
      });
    });

    it("defaults to newest send first", async () => {
      const results = await getSendsForUserPage(db, "test-user-11", ALL_SENDS_FILTER, 0);
      expect(results.sends.map((s) => s.climbName)).toEqual([
        "Test Highball",
        "Test Crimper",
        "Test Slab",
        "Test Crack",
      ]);
    });

    it("sorts oldest first, with an unknown date last", async () => {
      const results = await getSendsForUserPage(
        db,
        "test-user-11",
        { ...ALL_SENDS_FILTER, sort: "date_asc" },
        0,
      );
      expect(results.sends.map((s) => s.climbName)).toEqual([
        "Test Slab",
        "Test Crimper",
        "Test Highball",
        "Test Crack",
      ]);
    });

    it("sorts hardest grade first", async () => {
      const results = await getSendsForUserPage(
        db,
        "test-user-11",
        { ...ALL_SENDS_FILTER, sort: "grade_desc" },
        0,
      );
      expect(results.sends.map((s) => s.climbName)).toEqual([
        "Test Crimper",
        "Test Crack",
        "Test Highball",
        "Test Slab",
      ]);
    });

    it("sorts easiest grade first", async () => {
      const results = await getSendsForUserPage(
        db,
        "test-user-11",
        { ...ALL_SENDS_FILTER, sort: "grade_asc" },
        0,
      );
      expect(results.sends.map((s) => s.climbName)).toEqual([
        "Test Slab",
        "Test Highball",
        "Test Crack",
        "Test Crimper",
      ]);
    });

    it("sorts highest rated first, with an unrated send last", async () => {
      const results = await getSendsForUserPage(
        db,
        "test-user-11",
        { ...ALL_SENDS_FILTER, sort: "rating_desc" },
        0,
      );
      expect(results.sends.map((s) => s.climbName)).toEqual([
        "Test Highball",
        "Test Slab",
        "Test Crack",
        "Test Crimper",
      ]);
    });

    it("sorts lowest rated first, with an unrated send last", async () => {
      const results = await getSendsForUserPage(
        db,
        "test-user-11",
        { ...ALL_SENDS_FILTER, sort: "rating_asc" },
        0,
      );
      expect(results.sends.map((s) => s.climbName)).toEqual([
        "Test Crack",
        "Test Slab",
        "Test Highball",
        "Test Crimper",
      ]);
    });
  });
});

describe("getUserSendsSummary", () => {
  it("summarizes send count, distinct areas, and peak grade in the most-logged discipline", async () => {
    expect(await getUserSendsSummary(db, "test-user-1")).toEqual({
      sendCount: 2,
      areaCount: 2,
      peakGrade: "V4",
      mostLoggedDiscipline: { type: "boulder", count: 2 },
      latestSendDate: "2026-03-01",
    });
  });

  it("returns zeroed/null stats for a user with no sends", async () => {
    await seedFixtureUser(db, { id: "test-user-6", name: "Also No Sends" });
    expect(await getUserSendsSummary(db, "test-user-6")).toEqual({
      sendCount: 0,
      areaCount: 0,
      peakGrade: null,
      mostLoggedDiscipline: null,
      latestSendDate: null,
    });
  });
});

describe("getUserSentClimbIds", () => {
  it("returns every climb id the user has sent", async () => {
    const ids = await getUserSentClimbIds(db, "test-user-1");
    expect(ids).toEqual(new Set([1, 2]));
  });

  it("only includes the given user's own sends", async () => {
    const ids = await getUserSentClimbIds(db, "test-user-2");
    expect(ids).toEqual(new Set([1]));
  });

  it("returns an empty set for a user with no sends", async () => {
    await seedFixtureUser(db, { id: "test-user-4", name: "Also No Sends" });
    const ids = await getUserSentClimbIds(db, "test-user-4");
    expect(ids).toEqual(new Set());
  });
});

describe("getClimbSendStats", () => {
  it("averages ratings (ignoring nulls) and counts every send for a climb", async () => {
    // Test Highball (climb 1) has five sends by this point, from earlier
    // describe blocks' fixture seeding: ratings of 4 and 5, the rest null.
    const stats = await getClimbSendStats(db, [1]);
    expect(stats[1]).toEqual({ avgRating: 4.5, sendCount: 5, avgSuggestedGrade: null });
  });

  it("returns a null average when no send on the climb has a rating", async () => {
    // Test Crimper (climb 3) has three sends by this point, all with no rating.
    const stats = await getClimbSendStats(db, [3]);
    expect(stats[3]).toEqual({ avgRating: null, sendCount: 3, avgSuggestedGrade: null });
  });

  it("includes zero-send climbs in the requested ids rather than omitting them", async () => {
    // Id 999 doesn't match any send in this test file.
    const stats = await getClimbSendStats(db, [999]);
    expect(stats[999]).toEqual({ avgRating: null, sendCount: 0, avgSuggestedGrade: null });
  });

  it("returns an empty map for an empty id list, without querying", async () => {
    expect(await getClimbSendStats(db, [])).toEqual({});
  });

  it("averages non-null suggested grades independently of rating", async () => {
    await seedFixtureUser(db, { id: "test-user-7", name: "Grade Suggester" });
    await seedFixtureUser(db, { id: "test-user-8", name: "Grade Suggester Two" });
    // Test Crimper (climb 3) already has three sends from earlier describe
    // blocks ("excludes disciplines not selected", "name/areaName
    // filtering", "sort"), with no suggested grade.
    await seedFixtureSend(db, {
      userId: "test-user-7",
      climbId: 3,
      dateSent: "2026-01-01",
      suggestedGrade: 8,
    });
    await seedFixtureSend(db, {
      userId: "test-user-8",
      climbId: 3,
      dateSent: "2026-01-02",
      suggestedGrade: 10,
    });

    const stats = await getClimbSendStats(db, [3]);
    expect(stats[3]).toEqual({ avgRating: null, sendCount: 5, avgSuggestedGrade: 9 });
  });

  it("returns a null suggested-grade average when sends are rated but not grade-suggested", async () => {
    await seedFixtureUser(db, { id: "test-user-9", name: "Rater Only" });
    // Test Slab (climb 2) already has a null-rating send and a rating-3
    // send from earlier describe blocks; add a rating-5 send with no
    // suggested grade to confirm the two aggregates are computed
    // independently.
    await seedFixtureSend(db, {
      userId: "test-user-9",
      climbId: 2,
      dateSent: "2026-04-01",
      rating: 5,
    });

    const stats = await getClimbSendStats(db, [2]);
    expect(stats[2]).toEqual({ avgRating: 4, sendCount: 3, avgSuggestedGrade: null });
  });
});

// Placed last in the file, as its own top-level describe rather than nested
// inside getSendsForUserPage's — every other describe block above asserts
// exact cumulative send counts/averages for climbs 1-3 "by this point" in
// the file's fixture history, so adding more sends to those climbs anywhere
// earlier would shift those hardcoded numbers. Nothing runs after this.
describe("getSendsForUserPage ascentStyles/minRating filtering", () => {
  beforeAll(async () => {
    await seedFixtureUser(db, { id: "test-user-12", name: "Style Rating Tester" });
    await seedFixtureSend(db, {
      userId: "test-user-12",
      climbId: 1, // Test Highball
      dateSent: "2026-07-01",
      ascentStyle: "flash",
      rating: 5,
    });
    await seedFixtureSend(db, {
      userId: "test-user-12",
      climbId: 2, // Test Slab
      dateSent: "2026-07-02",
      ascentStyle: "redpoint",
      rating: 2,
    });
    await seedFixtureSend(db, {
      userId: "test-user-12",
      climbId: 3, // Test Crimper
      dateSent: "2026-07-03",
      ascentStyle: "onsight",
      // no rating
    });
  });

  it("returns every ascent style when none are selected (unfiltered, not empty)", async () => {
    const results = await getSendsForUserPage(db, "test-user-12", ALL_SENDS_FILTER, 0);
    expect(results.sends.map((s) => s.climbName).sort()).toEqual([
      "Test Crimper",
      "Test Highball",
      "Test Slab",
    ]);
  });

  it("filters down to a single selected ascent style", async () => {
    const results = await getSendsForUserPage(
      db,
      "test-user-12",
      { ...ALL_SENDS_FILTER, ascentStyles: ["flash"] },
      0,
    );
    expect(results.sends.map((s) => s.climbName)).toEqual(["Test Highball"]);
  });

  it("filters by multiple selected ascent styles", async () => {
    const results = await getSendsForUserPage(
      db,
      "test-user-12",
      { ...ALL_SENDS_FILTER, ascentStyles: ["flash", "onsight"] },
      0,
    );
    expect(results.sends.map((s) => s.climbName).sort()).toEqual(["Test Crimper", "Test Highball"]);
  });

  it("filters by a minimum rating, excluding unrated sends", async () => {
    const results = await getSendsForUserPage(
      db,
      "test-user-12",
      { ...ALL_SENDS_FILTER, minRating: 3 },
      0,
    );
    expect(results.sends.map((s) => s.climbName)).toEqual(["Test Highball"]);
  });

  it("combines ascent-style and minimum-rating filters", async () => {
    const results = await getSendsForUserPage(
      db,
      "test-user-12",
      { ...ALL_SENDS_FILTER, ascentStyles: ["redpoint", "onsight"], minRating: 1 },
      0,
    );
    expect(results.sends.map((s) => s.climbName)).toEqual(["Test Slab"]);
  });
});
