import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import { getAncestors, getArea, getNearestAncestors, getSubareas, searchAreas } from "./areas";
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

describe("getNearestAncestors", () => {
  it("returns the full chain when it's shorter than depth", async () => {
    const alcove = await getArea(db, 4);
    const ancestors = await getNearestAncestors(db, alcove!, 2);
    expect(ancestors.map((a) => a.name)).toEqual(["Test Crag", "Test Boulders"]);
  });

  it("keeps only the nearest `depth` ancestors, root-first among themselves", async () => {
    const alcove = await getArea(db, 4);
    const ancestors = await getNearestAncestors(db, alcove!, 1);
    expect(ancestors.map((a) => a.name)).toEqual(["Test Boulders"]);
  });

  it("returns an empty array for the root area", async () => {
    const root = await getArea(db, 1);
    const ancestors = await getNearestAncestors(db, root!, 2);
    expect(ancestors).toEqual([]);
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
