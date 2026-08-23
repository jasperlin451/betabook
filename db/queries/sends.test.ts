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
    completionType: "flash",
  });
  await seedFixtureSend(db, {
    userId: "test-user-1",
    climbId: 2,
    dateSent: "2026-03-01",
    completionType: "onsight",
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
    // Test Highball (climb 1) has four sends by this point, from earlier
    // describe blocks' fixture seeding: one rating of 4, the rest null.
    const stats = await getClimbSendStats(db, [1]);
    expect(stats[1]).toEqual({ avgRating: 4, sendCount: 4, avgSuggestedGrade: null });
  });

  it("returns a null average when no send on the climb has a rating", async () => {
    // Test Slab (climb 2) has exactly one send, with no rating.
    const stats = await getClimbSendStats(db, [2]);
    expect(stats[2]).toEqual({ avgRating: null, sendCount: 1, avgSuggestedGrade: null });
  });

  it("includes zero-send climbs in the requested ids rather than omitting them", async () => {
    // Test Crack (climb 4) has no sends anywhere in this test file.
    const stats = await getClimbSendStats(db, [4]);
    expect(stats[4]).toEqual({ avgRating: null, sendCount: 0, avgSuggestedGrade: null });
  });

  it("returns an empty map for an empty id list, without querying", async () => {
    expect(await getClimbSendStats(db, [])).toEqual({});
  });

  it("averages non-null suggested grades independently of rating", async () => {
    await seedFixtureUser(db, { id: "test-user-7", name: "Grade Suggester" });
    await seedFixtureUser(db, { id: "test-user-8", name: "Grade Suggester Two" });
    // Test Crimper (climb 3) already has two sends from earlier describe
    // blocks ("excludes disciplines not selected", "name/areaName
    // filtering"), with no suggested grade.
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
    expect(stats[3]).toEqual({ avgRating: null, sendCount: 4, avgSuggestedGrade: 9 });
  });

  it("returns a null suggested-grade average when sends are rated but not grade-suggested", async () => {
    await seedFixtureUser(db, { id: "test-user-9", name: "Rater Only" });
    // Test Slab (climb 2) already has one send with no rating/suggestion;
    // add a rated send with no suggested grade to confirm the two aggregates
    // are computed independently.
    await seedFixtureSend(db, {
      userId: "test-user-9",
      climbId: 2,
      dateSent: "2026-04-01",
      rating: 5,
    });

    const stats = await getClimbSendStats(db, [2]);
    expect(stats[2]).toEqual({ avgRating: 5, sendCount: 2, avgSuggestedGrade: null });
  });
});
