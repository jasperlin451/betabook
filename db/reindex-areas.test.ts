import { env } from "cloudflare:test";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import { areas, treeVersion } from "@/db/schema";
import { seedFixtureTree } from "@/test/fixtures";
import { computeAreaBounds, recomputeAreaTree, type AreaNode } from "./reindex-areas";

describe("computeAreaBounds", () => {
  it("assigns nested-set bounds via DFS, containing every descendant", () => {
    const nodes: AreaNode[] = [
      { id: 1, parentId: null, name: "Root" },
      { id: 2, parentId: 1, name: "Child A" },
      { id: 3, parentId: 1, name: "Child B" },
      { id: 4, parentId: 2, name: "Grandchild" },
    ];
    const bounds = computeAreaBounds(nodes);
    const root = bounds.get(1)!;
    const childA = bounds.get(2)!;
    const childB = bounds.get(3)!;
    const grandchild = bounds.get(4)!;

    expect(root.lft).toBeLessThan(childA.lft);
    expect(childA.rght).toBeLessThan(root.rght);
    expect(childA.lft).toBeLessThan(grandchild.lft);
    expect(grandchild.rght).toBeLessThan(childA.rght);
    expect(childA.lft).toBeLessThan(childB.lft); // siblings sorted by name
  });

  it("gives each root in a forest its own disjoint range", () => {
    const nodes: AreaNode[] = [
      { id: 1, parentId: null, name: "Root A" },
      { id: 2, parentId: null, name: "Root B" },
    ];
    const bounds = computeAreaBounds(nodes);
    expect(bounds.get(1)!.rght).toBeLessThan(bounds.get(2)!.lft);
  });

  it("throws when a node is unreachable from any root (parentId cycle)", () => {
    const nodes: AreaNode[] = [
      { id: 1, parentId: 2, name: "A" },
      { id: 2, parentId: 1, name: "B" },
    ];
    expect(() => computeAreaBounds(nodes)).toThrow(/unreachable/);
  });
});

describe("recomputeAreaTree", () => {
  let db: Database;

  beforeAll(async () => {
    db = createDb(env.DB);
    await seedFixtureTree(db);
  });

  it("assigns real bounds to a placeholder area and keeps every area properly nested under its parent", async () => {
    await db.insert(areas).values({ id: 100, parentId: 2, lft: 0, rght: 0, name: "New Alcove" });

    await recomputeAreaTree(db);

    const all = await db.select().from(areas);
    const byId = new Map(all.map((a) => [a.id, a]));
    const newArea = byId.get(100)!;
    const parent = byId.get(2)!;

    expect(newArea.lft).toBeGreaterThan(0);
    expect(newArea.rght).toBeGreaterThan(newArea.lft);
    expect(newArea.lft).toBeGreaterThan(parent.lft);
    expect(newArea.rght).toBeLessThan(parent.rght);

    for (const area of all) {
      if (area.parentId == null) continue;
      const p = byId.get(area.parentId)!;
      expect(area.lft).toBeGreaterThan(p.lft);
      expect(area.rght).toBeLessThan(p.rght);
    }
  });

  it("doesn't corrupt the tree when two recomputes race each other concurrently", async () => {
    await db.insert(areas).values([
      { id: 200, parentId: 2, lft: 0, rght: 0, name: "Concurrent A" },
      { id: 201, parentId: 3, lft: 0, rght: 0, name: "Concurrent B" },
    ]);

    await Promise.all([recomputeAreaTree(db), recomputeAreaTree(db)]);

    const all = await db.select().from(areas);
    const byId = new Map(all.map((a) => [a.id, a]));

    for (const area of all) {
      expect(area.rght).toBeGreaterThan(area.lft);
      if (area.parentId != null) {
        const p = byId.get(area.parentId)!;
        expect(area.lft).toBeGreaterThan(p.lft);
        expect(area.rght).toBeLessThan(p.rght);
      }
    }

    // Every pair of areas must be either disjoint or properly nested — a
    // pair that merely overlaps is the Frankentree symptom of two
    // interleaved recompute writes.
    for (const a of all) {
      for (const b of all) {
        if (a.id === b.id) continue;
        const aContainsB = a.lft < b.lft && b.rght < a.rght;
        const bContainsA = b.lft < a.lft && a.rght < b.rght;
        const disjoint = a.rght < b.lft || b.rght < a.lft;
        expect(aContainsB || bContainsA || disjoint).toBe(true);
      }
    }

    const [{ maxVersion }] = await db
      .select({ maxVersion: sql<number>`max(${treeVersion.version})` })
      .from(treeVersion);
    expect(maxVersion).toBeGreaterThanOrEqual(1);
  });
});
