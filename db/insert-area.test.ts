import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import { areas, climbs } from "@/db/schema";
import { getArea, getSubareas, getSubtreeClimbs } from "@/db/queries";
import { seedFixtureTree } from "@/test/fixtures";
import { insertAreaIntoTree, recomputeAreaTree } from "./reindex-areas";

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);
});

/** The whole-tree invariants a nested-set splice must preserve: every area
 * sits strictly inside its parent's range, every pair of areas is either
 * disjoint or properly nested (mere overlap is the corruption symptom),
 * and every climb mirrors its owning area's bounds exactly. Placeholder
 * (0/0) rows are exempt — they're pending by convention, not corrupted. */
async function expectValidTree() {
  const all = (await db.select().from(areas)).filter((a) => !(a.lft === 0 && a.rght === 0));
  const byId = new Map(all.map((a) => [a.id, a]));

  for (const area of all) {
    expect(area.rght).toBeGreaterThan(area.lft);
    if (area.parentId == null) continue;
    const parent = byId.get(area.parentId);
    if (!parent) continue; // parent itself still a placeholder
    expect(area.lft).toBeGreaterThan(parent.lft);
    expect(area.rght).toBeLessThan(parent.rght);
  }

  for (const a of all) {
    for (const b of all) {
      if (a.id === b.id) continue;
      const aContainsB = a.lft < b.lft && b.rght < a.rght;
      const bContainsA = b.lft < a.lft && a.rght < b.rght;
      const disjoint = a.rght < b.lft || b.rght < a.lft;
      expect(aContainsB || bContainsA || disjoint).toBe(true);
    }
  }

  const allClimbs = await db.select().from(climbs);
  for (const climb of allClimbs) {
    const area = byId.get(climb.areaId);
    if (!area) continue; // owning area still a placeholder
    expect({ id: climb.id, lft: climb.lft, rght: climb.rght }).toEqual({
      id: climb.id,
      lft: area.lft,
      rght: area.rght,
    });
  }
}

/** Inserts a climb the way createClimb does: denormalized lft/rght copied
 * from the owning area at insert time. */
async function seedClimbIn(areaId: number, name: string): Promise<number> {
  const area = await getArea(db, areaId);
  if (!area) throw new Error(`no area ${areaId}`);
  const [{ id }] = await db
    .insert(climbs)
    .values({ areaId, name, type: "boulder", grade: 3, lft: area.lft, rght: area.rght })
    .returning({ id: climbs.id });
  return id;
}

describe("insertAreaIntoTree", () => {
  it("splices a new leaf under its parent with immediately-correct bounds", async () => {
    const id = await insertAreaIntoTree(db, {
      parentId: 2,
      name: "Test Zzz Cave",
      description: null,
    });

    const [newArea, parent] = await Promise.all([getArea(db, id), getArea(db, 2)]);
    expect(newArea!.rght).toBe(newArea!.lft + 1);
    expect(newArea!.lft).toBeGreaterThan(parent!.lft);
    expect(newArea!.rght).toBeLessThan(parent!.rght);

    // Climbs in areas right of the splice point shifted along with their
    // areas; climbs left of it were untouched — either way they still
    // mirror their area exactly, and the tree stayed properly nested.
    await expectValidTree();
  });

  it("inserts at the name-sorted position among siblings, matching a full recompute's ordering", async () => {
    await insertAreaIntoTree(db, { parentId: 2, name: "Test Aaa Alcove", description: null });

    const names = (await getSubareas(db, 2)).map((a) => a.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    await expectValidTree();
  });

  it("makes a climb in a brand-new area visible on that area's page and every ancestor's page, and nowhere else", async () => {
    const id = await insertAreaIntoTree(db, {
      parentId: 2,
      name: "Test Fresh Sector",
      description: null,
    });
    await seedClimbIn(id, "Test Fresh Line");

    // Visible on the new area's own page…
    const own = await getSubtreeClimbs(db, (await getArea(db, id))!);
    expect(own.climbs.map((c) => c.name)).toEqual(["Test Fresh Line"]);

    // …and on its parent's and root ancestor's pages…
    for (const ancestorId of [2, 1]) {
      const listing = await getSubtreeClimbs(db, (await getArea(db, ancestorId))!);
      expect(listing.climbs.map((c) => c.name)).toContain("Test Fresh Line");
    }

    // …but not on an unrelated area's page (area 3 is the new area's
    // uncle), and pre-existing climbs don't bleed into the new area.
    const unrelated = await getSubtreeClimbs(db, (await getArea(db, 3))!);
    expect(unrelated.climbs.map((c) => c.name)).not.toContain("Test Fresh Line");
  });

  it("keeps concurrent creates under different parents from leaking into each other", async () => {
    const [aId, bId] = await Promise.all([
      insertAreaIntoTree(db, { parentId: 4, name: "Test Race Left", description: null }),
      insertAreaIntoTree(db, { parentId: 5, name: "Test Race Right", description: null }),
    ]);

    await seedClimbIn(aId, "Test Race Left Climb");
    await seedClimbIn(bId, "Test Race Right Climb");

    const aListing = await getSubtreeClimbs(db, (await getArea(db, aId))!);
    const bListing = await getSubtreeClimbs(db, (await getArea(db, bId))!);
    expect(aListing.climbs.map((c) => c.name)).toEqual(["Test Race Left Climb"]);
    expect(bListing.climbs.map((c) => c.name)).toEqual(["Test Race Right Climb"]);

    await expectValidTree();
  });

  it("gives a new root area its own disjoint range", async () => {
    const id = await insertAreaIntoTree(db, {
      parentId: null,
      name: "Test Zzz Region",
      description: null,
    });

    const newRoot = await getArea(db, id);
    expect(newRoot!.lft).toBeGreaterThan(0);
    expect(newRoot!.rght).toBe(newRoot!.lft + 1);
    await expectValidTree();
  });

  it("stays consistent when racing a concurrent full recompute", async () => {
    const [id] = await Promise.all([
      insertAreaIntoTree(db, { parentId: 3, name: "Test Recompute Race", description: null }),
      recomputeAreaTree(db),
    ]);

    const newArea = await getArea(db, id);
    const parent = await getArea(db, 3);
    expect(newArea!.lft).toBeGreaterThan(parent!.lft);
    expect(newArea!.rght).toBeLessThan(parent!.rght);
    await expectValidTree();
  });

  it("falls back to placeholder-plus-recompute under a not-yet-reindexed 0/0 parent", async () => {
    await db
      .insert(areas)
      .values({ id: 300, parentId: null, lft: 0, rght: 0, name: "Test Pending Region" });

    const id = await insertAreaIntoTree(db, {
      parentId: 300,
      name: "Test Pending Child",
      description: null,
    });

    // The awaited recompute assigned real bounds to both before returning.
    const [child, parent] = await Promise.all([getArea(db, id), getArea(db, 300)]);
    expect(parent!.rght).toBeGreaterThan(parent!.lft);
    expect(child!.lft).toBeGreaterThan(parent!.lft);
    expect(child!.rght).toBeLessThan(parent!.rght);
    await expectValidTree();

    await db.delete(areas).where(eq(areas.id, id));
    await db.delete(areas).where(eq(areas.id, 300));
  });
});
