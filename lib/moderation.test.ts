import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { createDb, type Database } from "@/db/client";
import { changeRequests } from "@/db/schema";
import { seedFixtureTree, seedFixtureUser } from "@/test/fixtures";

import { assertAreaReparentable, assertClimbMovable, submitChangeRequest } from "./moderation";

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
