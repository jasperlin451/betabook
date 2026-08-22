import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import {
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

  it("excludes everything when no disciplines are selected", async () => {
    const results = await getSendsForUserPage(db, "test-user-5", {
      ...ALL_SENDS_FILTER,
      disciplines: [],
    }, 0);
    expect(results.sends).toEqual([]);
  });

  it("filters by grade range within a discipline", async () => {
    // Test Highball is V4 (ordinal 5), Test Slab is V1 (ordinal 2).
    const highOnly = await getSendsForUserPage(db, "test-user-1", {
      ...ALL_SENDS_FILTER,
      boulderRange: [3, BOULDER_HUECO.length - 1],
    }, 0);
    expect(highOnly.sends.map((s) => s.climbName)).toEqual(["Test Highball"]);
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
