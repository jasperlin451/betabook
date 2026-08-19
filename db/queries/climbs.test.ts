import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import { climbs } from "@/db/schema";
import { getArea } from "./areas";
import { findClimbsByNameAndArea, getClimb, getSubtreeClimbs, searchClimbs } from "./climbs";
import { seedFixtureTree } from "@/test/fixtures";

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
