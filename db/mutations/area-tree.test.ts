import { env } from "cloudflare:test";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createDb } from "@/db/client";
import { createArea, createClimb, updateArea } from "@/db/mutations";
import { getArea, getSubareas, getSubtreeClimbs, findClimbCandidatesByNames } from "@/db/queries";
import { seedFixtureTree } from "@/test/fixtures";

/** A newly created area has to be *fully placed* the moment createArea
 * returns: its own page, its parent's sub-area list, and every ancestor's
 * subtree climb listing all have to agree immediately.
 *
 * That used to be untrue. Areas were inserted at a placeholder lft=0/rght=0
 * and repaired by a background recompute, but every subtree read treated 0/0
 * as a real coordinate — so until the repair landed, the new area's own page
 * matched `lft >= 0 AND lft <= 0`, i.e. every *other* pending climb in the
 * database, while ancestors matched none of them. Resolving ancestry from
 * parentId at read time removes the window rather than shortening it.
 *
 * Worth knowing what these can and can't prove: run against the old
 * implementation, only the rename case below fails. The rest pass, because
 * the recompute they were racing finishes well within a 5-area fixture — the
 * same reason the bug survived in the first place. They pin the invariant
 * going forward; they are not a reproduction of the old race. */

vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));

vi.mock("@/lib/session", async () => {
  const { NotSignedInError } = await import("@/lib/action-result");
  return {
    getSession: async () => ({ user: { id: "test-user" } }),
    requireSession: async () => ({ user: { id: "test-user" } }),
    NotSignedInError,
  };
});

vi.mock("@/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/client")>();
  const { env } = await import("cloudflare:test");
  return {
    ...actual,
    getDb: async () => actual.createDb(env.DB),
    getDbAndContext: async () => ({
      db: actual.createDb(env.DB),
      ctx: { waitUntil: () => {} } as unknown as ExecutionContext,
    }),
  };
});

const db = createDb(env.DB);

function areaForm(name: string): FormData {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("description", "");
  return formData;
}

function climbForm(name: string): FormData {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("type", "boulder");
  formData.set("grade", "5");
  formData.set("description", "");
  return formData;
}

/** Fixture tree: Test Crag (1) > Test Boulders (2) > {Test Highball Alcove
 * (4), Test Slab Area (5)}, and Test Crag (1) > Test Sport Wall (3). */
const TEST_CRAG = 1;
const TEST_BOULDERS = 2;
const TEST_SPORT_WALL = 3;

async function climbNamesUnder(areaId: number): Promise<string[]> {
  const area = await getArea(db, areaId);
  const { climbs } = await getSubtreeClimbs(db, area!, 1, "name_asc");
  return climbs.map((c) => c.name);
}

beforeAll(async () => {
  await seedFixtureTree(db);
});

describe("a brand-new area is immediately correct", () => {
  it("shows its climb on its own page and every ancestor's, and nowhere else", async () => {
    const created = await createArea(TEST_BOULDERS, areaForm("Test Roof Cave"));
    expect(created.ok).toBe(true);
    const newAreaId = created.ok ? created.value : 0;

    const climb = await createClimb(newAreaId, climbForm("Test Roof Problem"));
    expect(climb.ok).toBe(true);

    // Its own page, with no recompute having run in between.
    expect(await climbNamesUnder(newAreaId)).toEqual(["Test Roof Problem"]);

    // Both ancestors.
    expect(await climbNamesUnder(TEST_BOULDERS)).toContain("Test Roof Problem");
    expect(await climbNamesUnder(TEST_CRAG)).toContain("Test Roof Problem");

    // And nowhere off the ancestor chain.
    expect(await climbNamesUnder(TEST_SPORT_WALL)).not.toContain("Test Roof Problem");
  });

  it("reports its full ancestor chain to the CSV import lookup immediately", async () => {
    const created = await createArea(TEST_BOULDERS, areaForm("Test Import Alcove"));
    const newAreaId = created.ok ? created.value : 0;
    await createClimb(newAreaId, climbForm("Test Imported Climb"));

    // What the import wizard's Area column and hints are matched against.
    // Under the placeholder scheme this chain was empty until a recompute
    // landed, so the import reported "climb not found" for a climb the user
    // had just created.
    const [found] = await findClimbCandidatesByNames(db, ["Test Imported Climb"]);
    expect(found.areaId).toBe(newAreaId);
    expect(found.areaName).toBe("Test Import Alcove");
    expect(found.ancestors.map((a) => a.name)).toEqual(["Test Crag", "Test Boulders"]);
  });

  it("keeps concurrent creates under different parents out of each other's listings", async () => {
    const [underBoulders, underSportWall] = await Promise.all([
      createArea(TEST_BOULDERS, areaForm("Test Parallel Boulders Bay")),
      createArea(TEST_SPORT_WALL, areaForm("Test Parallel Sport Bay")),
    ]);
    const bouldersBayId = underBoulders.ok ? underBoulders.value : 0;
    const sportBayId = underSportWall.ok ? underSportWall.value : 0;

    await Promise.all([
      createClimb(bouldersBayId, climbForm("Test Parallel Boulder Problem")),
      createClimb(sportBayId, climbForm("Test Parallel Sport Route")),
    ]);

    // Two simultaneously-pending areas used to share the same 0/0 window, so
    // each one's page listed the other's climbs.
    expect(await climbNamesUnder(bouldersBayId)).toEqual(["Test Parallel Boulder Problem"]);
    expect(await climbNamesUnder(sportBayId)).toEqual(["Test Parallel Sport Route"]);
  });
});

describe("creating an area doesn't rewrite the rest of the tree", () => {
  it("leaves every pre-existing area and climb row untouched", async () => {
    const before = {
      areas: await db.all(sqlAllAreas()),
      climbs: await db.all(sqlAllClimbs()),
    };

    const created = await createArea(TEST_BOULDERS, areaForm("Test Untouched Bay"));
    const newAreaId = created.ok ? created.value : 0;
    await createClimb(newAreaId, climbForm("Test Untouched Problem"));

    const after = {
      areas: (await db.all<{ id: number }>(sqlAllAreas())).filter((r) => r.id !== newAreaId),
      climbs: (await db.all<{ areaId: number }>(sqlAllClimbs())).filter(
        (r) => r.areaId !== newAreaId,
      ),
    };

    // The nested-set encoding had to renumber a share of both tables on every
    // insert — measured at ~133k-303k rows against the production dataset.
    // Ancestry lives in parentId now, so an insert is an insert.
    expect(after.areas).toEqual(before.areas);
    expect(after.climbs).toEqual(before.climbs);
  });
});

describe("renaming an area", () => {
  it("reorders it among its siblings immediately", async () => {
    await createArea(TEST_CRAG, areaForm("Zzz Test Last Wall"));

    const before = (await getSubareas(db, TEST_CRAG)).map((a) => a.name);
    expect(before.at(-1)).toBe("Zzz Test Last Wall");

    const target = (await getSubareas(db, TEST_CRAG)).find((a) => a.name === "Zzz Test Last Wall");
    const renamed = await updateArea(target!.id, areaForm("Aaa Test First Wall"));
    expect(renamed.ok).toBe(true);

    // Sibling order came from areas.lft, which only moved when a full tree
    // recompute ran — and updateArea never triggered one, so a rename used to
    // leave the area sorted under its old name indefinitely.
    const after = (await getSubareas(db, TEST_CRAG)).map((a) => a.name);
    expect(after[0]).toBe("Aaa Test First Wall");
  });
});

/** Root areas exist — the seed data's continents — but nothing creates one:
 * an area with no parent isn't reachable by walking down from a continent, so
 * it would only ever surface in search. AreaForm refuses to submit without a
 * picked parent, and these pin the same rule at the mutation, which as a
 * server action is a callable endpoint in its own right. */
describe("a new area always goes under an existing one", () => {
  it("refuses a parent id that isn't an area", async () => {
    const created = await createArea(999999, areaForm("Test Orphan Wall"));
    expect(created).toEqual({ ok: false, error: "Parent area not found" });
  });

  it("refuses a missing parent rather than creating a root", async () => {
    const rootsBefore = await countRoots();

    // The signature rules this out for typed callers; the cast is the
    // untyped request such an endpoint can still be sent.
    const created = await createArea(null as unknown as number, areaForm("Test Orphan Continent"));

    expect(created).toEqual({ ok: false, error: "Parent area not found" });
    expect(await countRoots()).toBe(rootsBefore);
  });
});

async function countRoots(): Promise<number> {
  const { results } = await db.run(sql`SELECT COUNT(*) AS n FROM areas WHERE parent_id IS NULL`);
  return (results[0] as { n: number }).n;
}

// Declared after use for readability above; hoisted function declarations.
function sqlAllAreas() {
  return sql`SELECT id, parent_id AS parentId, name, description FROM areas ORDER BY id`;
}
function sqlAllClimbs() {
  return sql`
    SELECT id, area_id AS areaId, name, type, grade, send_count AS sendCount
    FROM climbs ORDER BY id
  `;
}
