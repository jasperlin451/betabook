import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createArea, createClimb } from "@/actions";
import { createDb } from "@/db/client";
import { searchAreas, searchClimbs } from "@/db/queries";
import { seedFixtureTree } from "@/test/fixtures";

/** The FTS indexes are maintained by triggers
 * (drizzle/migrations/0015_fts_sync_triggers.sql), inside the same statement
 * as each base-table write. These tests pin the sync on creation through the
 * real server actions and the real search queries. Areas/climbs can't be
 * renamed or deleted through the app anymore — name is immutable after
 * creation and deletion isn't offered at all — so those mutation shapes are
 * no longer exercised here; the underlying triggers still guard any
 * DB-level write that changes name or removes a row. */

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
});
