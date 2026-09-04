import { env } from "cloudflare:test";
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  requestAreaDelete,
  requestAreaEdit,
  requestAreaReparent,
  requestClimbDelete,
  requestClimbEdit,
  requestClimbMove,
} from "@/actions";
import { createDb } from "@/db/client";
import { searchAreas, searchClimbs } from "@/db/queries";
import { areas, changeRequests, climbs } from "@/db/schema";
import type { ChangeRequestType } from "@/lib/moderation";
import { seedFixtureSend, seedFixtureTree, seedFixtureUser } from "@/test/fixtures";

/** requestAreaEdit/requestAreaDelete/requestClimbEdit/requestClimbDelete are
 * the only path to a full edit (name/discipline/grade) or a delete —
 * updateArea/updateClimb only ever touch description, unrestricted, and
 * there's no direct delete at all (see actions/areas.ts, actions/climbs.ts).
 * These apply immediately for an admin and queue a changeRequests row for
 * everyone else. */

const sessionState = vi.hoisted(() => ({
  userId: "moderation-user" as string | null,
  role: null as string | null,
}));

vi.mock("next/cache", () => ({
  refresh: () => {},
  revalidatePath: () => {},
}));

vi.mock("@/lib/session", async () => {
  const { NotSignedInError } = await import("@/lib/action-result");
  return {
    getSession: async () =>
      sessionState.userId ? { user: { id: sessionState.userId, role: sessionState.role } } : null,
    requireSession: async () => {
      if (!sessionState.userId) throw new NotSignedInError();
      return { user: { id: sessionState.userId, role: sessionState.role } };
    },
    isAdmin: (session: { user: { role?: string | null } }) => session.user.role === "admin",
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

function areaFormData(name: string): FormData {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("description", "");
  return formData;
}

function climbFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    name: "Renamed Climb",
    type: "boulder",
    grade: "5",
    description: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

async function requestsFor(type: ChangeRequestType, entityId: number) {
  return db
    .select()
    .from(changeRequests)
    .where(and(eq(changeRequests.type, type), eq(changeRequests.entityId, entityId)));
}

beforeAll(async () => {
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: "moderation-user" });
});

beforeEach(() => {
  sessionState.userId = "moderation-user";
  sessionState.role = null;
});

// Fixture tree: Test Crag (1) > Test Boulders (2) > {Test Highball Alcove (4),
// Test Slab Area (5)}, and Test Crag (1) > Test Sport Wall (3).
describe("requestAreaEdit", () => {
  it("queues a change request instead of mutating for a non-admin", async () => {
    const result = await requestAreaEdit(3, areaFormData("Not Yet Renamed"));
    expect(result).toEqual({ ok: true, value: { status: "pending" } });

    expect((await db.select().from(areas).where(eq(areas.id, 3)).get())?.name).toBe(
      "Test Sport Wall",
    );
    const requests = await requestsFor("area_edit", 3);
    expect(requests).toHaveLength(1);
    expect(requests[0].requestedBy).toBe("moderation-user");
    expect(JSON.parse(requests[0].payload)).toEqual({ name: "Not Yet Renamed", description: null });
  });

  it("applies immediately for an admin and keeps the search index in sync", async () => {
    sessionState.role = "admin";
    // Area 2 is "Test Boulders".
    expect((await searchAreas(db, "Boulders")).areas.map((a) => a.id)).toEqual([2]);

    const result = await requestAreaEdit(2, areaFormData("Granite Garden"));
    expect(result).toEqual({ ok: true, value: { status: "applied" } });

    expect((await searchAreas(db, "Granite Garden")).areas.map((a) => a.id)).toEqual([2]);
    expect((await searchAreas(db, "Boulders")).areas).toEqual([]);
    expect(await requestsFor("area_edit", 2)).toHaveLength(0);
  });
});

describe("requestAreaDelete", () => {
  it("rejects immediately, without queuing, when the area isn't deletable", async () => {
    // Area 1 (Test Crag) has sub-areas.
    expect(await requestAreaDelete(1)).toEqual({
      ok: false,
      error: "Can't delete an area with sub-areas",
    });
    expect(await requestsFor("area_delete", 1)).toHaveLength(0);
  });

  it("queues a deletable area's removal for a non-admin", async () => {
    await db.insert(areas).values({ id: 101, parentId: 2, name: "Empty Leaf" });

    const result = await requestAreaDelete(101);
    expect(result).toEqual({ ok: true, value: { status: "pending" } });

    expect(await db.select().from(areas).where(eq(areas.id, 101)).get()).toBeDefined();
    const requests = await requestsFor("area_delete", 101);
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0].payload)).toEqual({});
  });

  it("applies immediately for an admin and removes it from the search index", async () => {
    sessionState.role = "admin";
    await db.insert(areas).values({ id: 102, parentId: 2, name: "Ephemeral Cove" });
    expect((await searchAreas(db, "Ephemeral Cove")).areas).toHaveLength(1);

    expect(await requestAreaDelete(102)).toEqual({ ok: true, value: { status: "applied" } });

    expect(await db.select().from(areas).where(eq(areas.id, 102)).get()).toBeUndefined();
    expect((await searchAreas(db, "Ephemeral Cove")).areas).toEqual([]);
  });
});

describe("requestClimbEdit", () => {
  it("queues a change request instead of mutating for a non-admin", async () => {
    const result = await requestClimbEdit(3, climbFormData({ name: "Not Yet Renamed" }));
    expect(result).toEqual({ ok: true, value: { status: "pending" } });

    expect((await db.select().from(climbs).where(eq(climbs.id, 3)).get())?.name).toBe(
      "Test Crimper",
    );
    const requests = await requestsFor("climb_edit", 3);
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0].payload)).toMatchObject({ name: "Not Yet Renamed" });
  });

  it("applies immediately for an admin and keeps the search index in sync", async () => {
    sessionState.role = "admin";
    // Climb 3 is "Test Crimper" (sport 5.10a — grade index 10).
    expect(
      (await searchClimbs(db, { name: "Crimper", disciplines: [] })).climbs.map((c) => c.id),
    ).toEqual([3]);

    const result = await requestClimbEdit(
      3,
      climbFormData({ name: "Dyno Dance", type: "sport", grade: "10" }),
    );
    expect(result).toEqual({ ok: true, value: { status: "applied" } });

    expect(
      (await searchClimbs(db, { name: "Dyno Dance", disciplines: [] })).climbs.map((c) => c.id),
    ).toEqual([3]);
    expect((await searchClimbs(db, { name: "Crimper", disciplines: [] })).climbs).toEqual([]);
  });

  it("rejects a discipline change once sends have been logged, even for an admin", async () => {
    sessionState.role = "admin";
    await seedFixtureSend(db, { userId: "moderation-user", climbId: 1, dateSent: "2026-01-01" });

    const result = await requestClimbEdit(
      1,
      climbFormData({ name: "Test Highball", type: "sport" }),
    );
    expect(result).toEqual({
      ok: false,
      error: "Can't change discipline once a climb has logged sends",
    });
  });
});

describe("requestClimbDelete", () => {
  it("rejects immediately, without queuing, when the climb has logged sends", async () => {
    // Climb 1 already has a send logged from the requestClimbEdit block above.
    expect(await requestClimbDelete(1)).toEqual({
      ok: false,
      error: "Can't delete a climb with logged sends",
    });
    expect(await requestsFor("climb_delete", 1)).toHaveLength(0);
  });

  it("queues a deletable climb's removal for a non-admin", async () => {
    const result = await requestClimbDelete(2);
    expect(result).toEqual({ ok: true, value: { status: "pending" } });

    expect(await db.select().from(climbs).where(eq(climbs.id, 2)).get()).toBeDefined();
    const requests = await requestsFor("climb_delete", 2);
    expect(requests).toHaveLength(1);
  });

  it("applies immediately for an admin and removes it from the search index", async () => {
    sessionState.role = "admin";
    await db
      .insert(climbs)
      .values({ id: 200, areaId: 3, name: "Ephemeral Problem", type: "boulder", grade: 3 });
    expect(
      (await searchClimbs(db, { name: "Ephemeral Problem", disciplines: [] })).climbs,
    ).toHaveLength(1);

    expect(await requestClimbDelete(200)).toEqual({ ok: true, value: { status: "applied" } });

    expect(await db.select().from(climbs).where(eq(climbs.id, 200)).get()).toBeUndefined();
    expect((await searchClimbs(db, { name: "Ephemeral Problem", disciplines: [] })).climbs).toEqual(
      [],
    );
  });
});

describe("requestAreaReparent", () => {
  it("queues a change request instead of mutating for a non-admin", async () => {
    const result = await requestAreaReparent(5, 3);
    expect(result).toEqual({ ok: true, value: { status: "pending" } });

    expect((await db.select().from(areas).where(eq(areas.id, 5)).get())?.parentId).toBe(2);
    const requests = await requestsFor("area_reparent", 5);
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0].payload)).toEqual({ newParentId: 3 });
  });

  it("rejects immediately, without queuing, when the move is illegal", async () => {
    // Area 4 (Test Highball Alcove) is a child of area 2 (Test Boulders) —
    // can't move area 2 under its own sub-area.
    expect(await requestAreaReparent(2, 4)).toEqual({
      ok: false,
      error: "Can't move an area under itself or one of its own sub-areas",
    });
    expect(await requestsFor("area_reparent", 2)).toHaveLength(0);
  });

  it("applies immediately for an admin", async () => {
    sessionState.role = "admin";
    await db.insert(areas).values({ id: 300, parentId: 1, name: "Ephemeral Buttress" });
    await db.insert(areas).values({ id: 301, parentId: 3, name: "Ephemeral Ledge" });

    const result = await requestAreaReparent(300, 301);
    expect(result).toEqual({ ok: true, value: { status: "applied" } });

    expect((await db.select().from(areas).where(eq(areas.id, 300)).get())?.parentId).toBe(301);
    expect(await requestsFor("area_reparent", 300)).toHaveLength(0);
  });
});

describe("requestClimbMove", () => {
  it("queues a change request instead of mutating for a non-admin", async () => {
    const result = await requestClimbMove(4, 5);
    expect(result).toEqual({ ok: true, value: { status: "pending" } });

    expect((await db.select().from(climbs).where(eq(climbs.id, 4)).get())?.areaId).toBe(3);
    const requests = await requestsFor("climb_move", 4);
    expect(requests).toHaveLength(1);
    expect(JSON.parse(requests[0].payload)).toEqual({ newAreaId: 5 });
  });

  it("rejects immediately, without queuing, for an unknown destination area", async () => {
    await db
      .insert(climbs)
      .values({ id: 401, areaId: 3, name: "Ephemeral Arete", type: "boulder", grade: 3 });

    expect(await requestClimbMove(401, 999999)).toEqual({ ok: false, error: "Area not found" });
    expect(await requestsFor("climb_move", 401)).toHaveLength(0);
  });

  it("applies immediately for an admin and keeps the search index in sync", async () => {
    sessionState.role = "admin";
    await db
      .insert(climbs)
      .values({ id: 400, areaId: 3, name: "Ephemeral Traverse", type: "boulder", grade: 3 });

    const result = await requestClimbMove(400, 5);
    expect(result).toEqual({ ok: true, value: { status: "applied" } });

    expect((await db.select().from(climbs).where(eq(climbs.id, 400)).get())?.areaId).toBe(5);
    expect(await requestsFor("climb_move", 400)).toHaveLength(0);
  });
});
