import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createArea,
  createClimb,
  deleteArea,
  deleteClimb,
  updateArea,
  updateClimb,
} from "@/actions";
import { createDb } from "@/db/client";
import { searchAreas, searchClimbs } from "@/db/queries";
import { seedFixtureTree } from "@/test/fixtures";

/** The FTS indexes are maintained by triggers
 * (drizzle/migrations/0015_fts_sync_triggers.sql), inside the same statement
 * as each base-table write. These tests pin the sync across every mutation
 * shape — create, rename, delete — through the real server actions and the
 * real search queries. Renames especially: they used to bypass the index
 * entirely, leaving the entity findable only under its old name. */

const sessionState = vi.hoisted(() => ({ userId: "test-user" as string | null }));

vi.mock("next/cache", () => ({
  refresh: () => {},
  revalidatePath: () => {},
}));

// See mutations.test.ts — stub the session (the real one needs a Next
// request) and point getDb/getDbAndContext at the test D1 binding.
vi.mock("@/lib/session", async () => {
  const { NotSignedInError } = await import("@/lib/action-result");
  return {
    getSession: async () => (sessionState.userId ? { user: { id: sessionState.userId } } : null),
    requireSession: async () => {
      if (!sessionState.userId) throw new NotSignedInError();
      return { user: { id: sessionState.userId } };
    },
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

function climbFormData(name: string, overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    name,
    type: "boulder",
    grade: "3",
    description: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

beforeAll(async () => {
  await seedFixtureTree(db);
});

beforeEach(() => {
  sessionState.userId = "test-user";
});

describe("FTS sync triggers", () => {
  // Runs first, against the pristine fixture tree: seedFixtureTree no longer
  // seeds the FTS tables by hand, so a duplicate here would mean the
  // triggers and some manual insert both indexed the same row.
  it("indexes each seeded row exactly once", async () => {
    expect((await searchAreas(db, "Test Crag")).areas).toHaveLength(1);
    expect((await searchClimbs(db, { name: "Test Crack", disciplines: [] })).climbs).toHaveLength(
      1,
    );
  });

  it("makes a renamed area searchable under its new name and not its old one", async () => {
    // Area 2 is "Test Boulders".
    expect((await searchAreas(db, "Boulders")).areas.map((a) => a.id)).toEqual([2]);

    expect(await updateArea(2, areaFormData("Granite Garden"))).toEqual({
      ok: true,
      value: undefined,
    });

    expect((await searchAreas(db, "Granite Garden")).areas.map((a) => a.id)).toEqual([2]);
    expect((await searchAreas(db, "Boulders")).areas).toEqual([]);
  });

  it("makes a renamed climb searchable under its new name and not its old one", async () => {
    // Climb 3 is "Test Crimper" (sport 5.10a — grade index 10).
    expect(
      (await searchClimbs(db, { name: "Crimper", disciplines: [] })).climbs.map((c) => c.id),
    ).toEqual([3]);

    expect(
      await updateClimb(3, climbFormData("Dyno Dance", { type: "sport", grade: "10" })),
    ).toEqual({ ok: true, value: undefined });

    expect(
      (await searchClimbs(db, { name: "Dyno Dance", disciplines: [] })).climbs.map((c) => c.id),
    ).toEqual([3]);
    expect((await searchClimbs(db, { name: "Crimper", disciplines: [] })).climbs).toEqual([]);
  });

  it("makes a created area searchable immediately", async () => {
    const result = await createArea(1, areaFormData("Fresh Gully"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((await searchAreas(db, "Fresh Gully")).areas.map((a) => a.id)).toEqual([result.value]);
    }
  });

  it("makes a created climb searchable immediately", async () => {
    const result = await createClimb(4, climbFormData("Fresh Problem"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(
        (await searchClimbs(db, { name: "Fresh Problem", disciplines: [] })).climbs.map(
          (c) => c.id,
        ),
      ).toEqual([result.value]);
    }
  });

  it("removes a deleted area from the index", async () => {
    const created = await createArea(1, areaFormData("Ephemeral Cove"));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await searchAreas(db, "Ephemeral Cove")).areas).toHaveLength(1);

    expect(await deleteArea(created.value)).toEqual({ ok: true, value: undefined });
    expect((await searchAreas(db, "Ephemeral Cove")).areas).toEqual([]);
  });

  // Regression: deleteClimb never issued the manual climbs_fts cleanup, so a
  // deleted climb kept matching its name in search until the triggers took
  // over the sync.
  it("removes a deleted climb from the index", async () => {
    // Climb 2 is "Test Slab" (no sends seeded, so it's deletable).
    expect(
      (await searchClimbs(db, { name: "Slab", disciplines: [] })).climbs.map((c) => c.id),
    ).toEqual([2]);

    expect(await deleteClimb(2)).toEqual({ ok: true, value: undefined });
    expect((await searchClimbs(db, { name: "Slab", disciplines: [] })).climbs).toEqual([]);
  });
});
