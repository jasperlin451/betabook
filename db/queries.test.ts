import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "./client";
import {
  getAncestors,
  getArea,
  getClimb,
  getSendsForClimb,
  getSendsForUser,
  getSubareas,
  getSubtreeClimbs,
  getUser,
  getUserSendForClimb,
  searchAreas,
  searchClimbs,
} from "./queries";
import { seedFixtureSend, seedFixtureTree, seedFixtureUser } from "@/test/fixtures";

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

describe("getArea", () => {
  it("returns the area for a known id", async () => {
    const area = await getArea(db, 1);
    expect(area?.name).toBe("Test Crag");
  });

  it("returns undefined for an unknown id", async () => {
    const area = await getArea(db, 999999);
    expect(area).toBeUndefined();
  });
});

describe("getSubareas", () => {
  it("returns only direct children, not grandchildren", async () => {
    const subareas = await getSubareas(db, 1);
    expect(subareas.map((a) => a.name).sort()).toEqual([
      "Test Boulders",
      "Test Sport Wall",
    ]);
  });

  it("returns an empty array for a leaf area", async () => {
    const subareas = await getSubareas(db, 3);
    expect(subareas).toEqual([]);
  });
});

describe("getAncestors", () => {
  it("returns an empty array for the root area", async () => {
    const root = await getArea(db, 1);
    const ancestors = await getAncestors(db, root!);
    expect(ancestors).toEqual([]);
  });

  it("returns the full root-first chain for a two-level-deep area", async () => {
    const alcove = await getArea(db, 4);
    const ancestors = await getAncestors(db, alcove!);
    expect(ancestors.map((a) => a.name)).toEqual(["Test Crag", "Test Boulders"]);
  });

  it("returns exactly one ancestor for a one-level-deep area", async () => {
    const sportWall = await getArea(db, 3);
    const ancestors = await getAncestors(db, sportWall!);
    expect(ancestors.map((a) => a.name)).toEqual(["Test Crag"]);
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

  it("groups boulder before rope, without interleaving, then sorts by grade within each group", async () => {
    const root = await getArea(db, 1);
    const { climbs } = await getSubtreeClimbs(db, root!);
    // boulder: Test Slab (grade 2) then Test Highball (grade 5)
    // rope: Test Crack (grade 6) then Test Crimper (grade 10) — sport and trad interleaved by grade
    expect(climbs.map((c) => c.name)).toEqual([
      "Test Slab",
      "Test Highball",
      "Test Crack",
      "Test Crimper",
    ]);
  });
});

describe("searchAreas", () => {
  it("fuzzy-matches on partial area name", async () => {
    const results = await searchAreas(db, "Bould");
    expect(results.map((a) => a.name)).toContain("Test Boulders");
  });

  it("does not throw on FTS5 query-syntax characters in the input", async () => {
    const results = await searchAreas(db, 'Boulders"');
    expect(results.map((a) => a.name)).toContain("Test Boulders");
  });

  it("returns an empty array when nothing matches", async () => {
    const results = await searchAreas(db, "NoSuchAreaNameAtAll");
    expect(results).toEqual([]);
  });
});

describe("searchClimbs", () => {
  it("matches by climb name", async () => {
    const results = await searchClimbs(db, { name: "Crimper", disciplines: [] });
    expect(results.map((c) => c.name)).toEqual(["Test Crimper"]);
  });

  it("fuzzy-matches by partial climb name", async () => {
    const results = await searchClimbs(db, { name: "Crim", disciplines: [] });
    expect(results.map((c) => c.name)).toEqual(["Test Crimper"]);
  });

  it("matches by area name against the climb's own area or any ancestor", async () => {
    // "Test Boulders" is an ancestor of the climbs' actual areas (the alcove/slab
    // sub-areas), not their direct area — this is the nested-set ancestor match.
    const results = await searchClimbs(db, { areaName: "Boulders", disciplines: [] });
    expect(results.map((c) => c.name).sort()).toEqual(["Test Highball", "Test Slab"]);
  });

  it("returns an empty array when the area name matches nothing", async () => {
    const results = await searchClimbs(db, {
      areaName: "NoSuchAreaNameAtAll",
      disciplines: [],
    });
    expect(results).toEqual([]);
  });

  it("filters by a single discipline's grade range", async () => {
    const results = await searchClimbs(db, {
      disciplines: ["boulder"],
      boulderRange: [5, 5],
    });
    expect(results.map((c) => c.name)).toEqual(["Test Highball"]);
  });

  it("filters by both disciplines independently without interleaving", async () => {
    const results = await searchClimbs(db, {
      disciplines: ["boulder", "trad"],
      boulderRange: [5, 5],
      tradRange: [6, 6],
    });
    expect(results.map((c) => c.name).sort()).toEqual(["Test Crack", "Test Highball"]);
  });

  it("filters sport and trad independently by their own grade ranges", async () => {
    const results = await searchClimbs(db, {
      disciplines: ["sport", "trad"],
      sportRange: [10, 10],
      tradRange: [0, 0],
    });
    expect(results.map((c) => c.name)).toEqual(["Test Crimper"]);
  });

  it("excludes climbs outside the requested grade range", async () => {
    const results = await searchClimbs(db, {
      disciplines: ["boulder"],
      boulderRange: [0, 3],
    });
    expect(results.map((c) => c.name)).toEqual(["Test Slab"]);
  });
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

describe("getUser", () => {
  it("returns the user for a known id", async () => {
    const user = await getUser(db, "test-user-1");
    expect(user?.name).toBe("Alice Climber");
  });

  it("returns undefined for an unknown id", async () => {
    const user = await getUser(db, "no-such-user");
    expect(user).toBeUndefined();
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

describe("getSendsForUser", () => {
  it("returns every send across a user's climbs, newest dateSent first", async () => {
    const results = await getSendsForUser(db, "test-user-1");
    expect(results.map((s) => s.climbName)).toEqual(["Test Slab", "Test Highball"]);
  });

  it("returns an empty array for a user with no sends", async () => {
    await seedFixtureUser(db, { id: "test-user-3", name: "No Sends" });
    const results = await getSendsForUser(db, "test-user-3");
    expect(results).toEqual([]);
  });
});
