import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "./client";
import {
  getAncestors,
  getArea,
  getSubareas,
  getSubtreeClimbs,
  searchAreas,
  searchClimbs,
} from "./queries";
import { seedFixtureTree } from "@/test/fixtures";

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);
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
    const results = await searchAreas(db, "Boulders");
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
      disciplines: ["boulder", "rope"],
      boulderRange: [5, 5],
      ropeRange: [6, 6],
    });
    expect(results.map((c) => c.name).sort()).toEqual(["Test Crack", "Test Highball"]);
  });

  it("excludes climbs outside the requested grade range", async () => {
    const results = await searchClimbs(db, {
      disciplines: ["boulder"],
      boulderRange: [0, 3],
    });
    expect(results.map((c) => c.name)).toEqual(["Test Slab"]);
  });
});
