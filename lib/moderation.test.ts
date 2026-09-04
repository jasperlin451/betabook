import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { createDb, type Database } from "@/db/client";
import { adminAreaScopes, changeRequests, climbs, sends } from "@/db/schema";
import { seedFixtureSend, seedFixtureTree, seedFixtureUser } from "@/test/fixtures";

vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));

import {
  applyClimbMerge,
  assertAreaReparentable,
  assertClimbMergeable,
  assertClimbMovable,
  isAdminForArea,
  MERGE_COMMENT_SEPARATOR,
  submitChangeRequest,
} from "./moderation";

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: "moderation-requester" });
});

describe("submitChangeRequest", () => {
  it("stores the payload as JSON on a pending row and returns its id", async () => {
    const id = await submitChangeRequest(db, "area_edit", 1, "moderation-requester", {
      name: "Renamed Crag",
      description: null,
    });

    const row = await db.select().from(changeRequests).where(eq(changeRequests.id, id)).get();
    expect(row?.type).toBe("area_edit");
    expect(row?.entityId).toBe(1);
    expect(row?.requestedBy).toBe("moderation-requester");
    expect(row?.status).toBe("pending");
    expect(row?.reviewedBy).toBeNull();
    expect(JSON.parse(row?.payload ?? "")).toEqual({ name: "Renamed Crag", description: null });
  });

  it("gives each request its own id", async () => {
    const first = await submitChangeRequest(db, "climb_delete", 1, "moderation-requester", {});
    const second = await submitChangeRequest(db, "climb_delete", 2, "moderation-requester", {});
    expect(first).not.toBe(second);
  });
});

// Fixture tree: Test Crag (1) > Test Boulders (2) > {Test Highball Alcove (4),
// Test Slab Area (5)}, and Test Crag (1) > Test Sport Wall (3).
describe("isAdminForArea", () => {
  beforeAll(async () => {
    await seedFixtureUser(db, { id: "scope-admin" });
    await seedFixtureUser(db, { id: "roleless-scope-admin" });
    await db.insert(adminAreaScopes).values({ userId: "scope-admin", areaId: 2 });
  });

  it("is false for a non-admin role, even with a managed area", async () => {
    expect(await isAdminForArea(db, { user: { id: "scope-admin", role: null } }, 4)).toBe(false);
  });

  it("is false for an admin with no managed areas at all", async () => {
    expect(
      await isAdminForArea(db, { user: { id: "roleless-scope-admin", role: "admin" } }, 4),
    ).toBe(false);
  });

  it("is true for the managed area itself", async () => {
    expect(await isAdminForArea(db, { user: { id: "scope-admin", role: "admin" } }, 2)).toBe(true);
  });

  it("is true for a descendant of the managed area", async () => {
    // Area 4 (Test Highball Alcove) is under area 2 (Test Boulders).
    expect(await isAdminForArea(db, { user: { id: "scope-admin", role: "admin" } }, 4)).toBe(true);
  });

  it("is false outside the managed area's subtree", async () => {
    // Area 3 (Test Sport Wall) is a sibling of area 2, not under it.
    expect(await isAdminForArea(db, { user: { id: "scope-admin", role: "admin" } }, 3)).toBe(false);
  });
});

// Fixture tree: Test Crag (1) > Test Boulders (2) > {Test Highball Alcove (4),
// Test Slab Area (5)}, and Test Crag (1) > Test Sport Wall (3).
describe("assertAreaReparentable", () => {
  it("rejects an area as its own parent", async () => {
    await expect(assertAreaReparentable(db, 2, 2)).rejects.toThrow(
      "Can't move an area under itself or one of its own sub-areas",
    );
  });

  it("rejects moving an area under its own descendant", async () => {
    await expect(assertAreaReparentable(db, 2, 4)).rejects.toThrow(
      "Can't move an area under itself or one of its own sub-areas",
    );
  });

  it("rejects an unknown area", async () => {
    await expect(assertAreaReparentable(db, 999999, 3)).rejects.toThrow("Area not found");
  });

  it("rejects an unknown parent", async () => {
    await expect(assertAreaReparentable(db, 3, 999999)).rejects.toThrow("Parent area not found");
  });

  it("returns the existing area for a legal move", async () => {
    const existing = await assertAreaReparentable(db, 3, 5);
    expect(existing.id).toBe(3);
  });
});

describe("assertClimbMovable", () => {
  it("rejects an unknown climb", async () => {
    await expect(assertClimbMovable(db, 999999, 3)).rejects.toThrow("Climb not found");
  });

  it("rejects an unknown area", async () => {
    await expect(assertClimbMovable(db, 1, 999999)).rejects.toThrow("Area not found");
  });

  it("returns the existing climb for a legal move", async () => {
    const existing = await assertClimbMovable(db, 1, 3);
    expect(existing.id).toBe(1);
  });
});

describe("assertClimbMergeable", () => {
  it("rejects merging a climb into itself", async () => {
    await expect(assertClimbMergeable(db, 1, 1)).rejects.toThrow("Can't merge a climb into itself");
  });

  it("rejects an unknown source climb", async () => {
    await expect(assertClimbMergeable(db, 999999, 1)).rejects.toThrow("Climb not found");
  });

  it("rejects an unknown target climb", async () => {
    await expect(assertClimbMergeable(db, 1, 999999)).rejects.toThrow("Target climb not found");
  });

  it("rejects merging climbs of different disciplines", async () => {
    // Climb 1 is a boulder, climb 3 is sport.
    await expect(assertClimbMergeable(db, 1, 3)).rejects.toThrow(
      "Can't merge climbs of different disciplines",
    );
  });

  it("returns both climbs for a legal merge", async () => {
    const { source, target } = await assertClimbMergeable(db, 1, 2);
    expect(source.id).toBe(1);
    expect(target.id).toBe(2);
  });
});

describe("applyClimbMerge", () => {
  it("rejects a discipline mismatch without touching either climb", async () => {
    await db.insert(climbs).values([
      { id: 900, areaId: 3, name: "Merge Boulder", type: "boulder", grade: 3 },
      { id: 901, areaId: 3, name: "Merge Sport", type: "sport", grade: 8 },
    ]);

    await expect(applyClimbMerge(db, 900, 901)).rejects.toThrow(
      "Can't merge climbs of different disciplines",
    );
    expect(await db.select().from(climbs).where(eq(climbs.id, 900)).get()).toBeDefined();
    expect(await db.select().from(climbs).where(eq(climbs.id, 901)).get()).toBeDefined();
  });

  it("reassigns a non-colliding send and deletes the source climb", async () => {
    await seedFixtureUser(db, { id: "merge-user-a" });
    await db.insert(climbs).values([
      { id: 910, areaId: 3, name: "Merge Source A", type: "boulder", grade: 3 },
      { id: 911, areaId: 3, name: "Merge Target A", type: "boulder", grade: 3 },
    ]);
    await seedFixtureSend(db, {
      userId: "merge-user-a",
      climbId: 910,
      dateSent: "2026-01-01",
      rating: 4,
    });

    await applyClimbMerge(db, 910, 911);

    expect(await db.select().from(climbs).where(eq(climbs.id, 910)).get()).toBeUndefined();
    const target = await db.select().from(climbs).where(eq(climbs.id, 911)).get();
    expect(target?.sendCount).toBe(1);
    expect(target?.ratingSum).toBe(4);

    const send = await db.select().from(sends).where(eq(sends.userId, "merge-user-a")).get();
    expect(send?.climbId).toBe(911);
    expect(send?.rating).toBe(4);
  });

  it("folds comments and drops the source's other fields when a user sent both climbs", async () => {
    await seedFixtureUser(db, { id: "merge-user-b" });
    await db.insert(climbs).values([
      { id: 920, areaId: 3, name: "Merge Source B", type: "boulder", grade: 3 },
      { id: 921, areaId: 3, name: "Merge Target B", type: "boulder", grade: 3 },
    ]);
    await seedFixtureSend(db, {
      userId: "merge-user-b",
      climbId: 920,
      dateSent: "2026-01-01",
      comment: "Source comment",
      rating: 5,
    });
    await seedFixtureSend(db, {
      userId: "merge-user-b",
      climbId: 921,
      dateSent: "2026-02-01",
      comment: "Target comment",
      rating: 2,
    });

    await applyClimbMerge(db, 920, 921);

    expect(await db.select().from(climbs).where(eq(climbs.id, 920)).get()).toBeUndefined();
    const rows = await db.select().from(sends).where(eq(sends.userId, "merge-user-b"));
    expect(rows).toHaveLength(1);
    expect(rows[0].climbId).toBe(921);
    // The target's send survives — its dateSent/rating win, not the source's.
    expect(rows[0].dateSent).toBe("2026-02-01");
    expect(rows[0].rating).toBe(2);
    expect(rows[0].comment).toBe(`Target comment${MERGE_COMMENT_SEPARATOR}Source comment`);

    const target = await db.select().from(climbs).where(eq(climbs.id, 921)).get();
    expect(target?.sendCount).toBe(1);
  });

  it("applies overrides to the surviving climb", async () => {
    await db.insert(climbs).values([
      { id: 930, areaId: 3, name: "Merge Source C", type: "boulder", grade: 3 },
      { id: 931, areaId: 3, name: "Merge Target C", type: "boulder", grade: 3 },
    ]);

    await applyClimbMerge(db, 930, 931, { name: "Merged Name" });

    const target = await db.select().from(climbs).where(eq(climbs.id, 931)).get();
    expect(target?.name).toBe("Merged Name");
  });
});
