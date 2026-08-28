import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { eq, inArray } from "drizzle-orm";
import { createDb } from "@/db/client";
import { climbs, sends } from "@/db/schema";
import { GENERIC_ERROR_MESSAGE } from "@/lib/action-result";
import type { NormalizedImportRow } from "@/lib/sends-import";
import { seedFixtureSend, seedFixtureTree, seedFixtureUser, seedManyClimbs } from "@/test/fixtures";
import { importSends } from "@/db/mutations";

/** importSends's commit contract: each call is all-or-nothing (one db.batch
 * = one D1 transaction), duplicate rows are skipped via the user+climb key
 * so retries are safe, and every surface the write touches is revalidated.
 * These tests pin all three. */

const sessionState = vi.hoisted(() => ({ userId: "import-user" as string | null }));

const cacheMocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/cache", () => cacheMocks);

// See db/mutations/mutations.test.ts for why the session is stubbed rather
// than run for real.
vi.mock("@/lib/session", async () => {
  const { NotSignedInError } = await import("@/lib/action-result");
  return {
    getSession: async () =>
      sessionState.userId ? { user: { id: sessionState.userId } } : null,
    requireSession: async () => {
      if (!sessionState.userId) throw new NotSignedInError();
      return { user: { id: sessionState.userId } };
    },
  };
});

// Point the action's getDb at the test D1 binding, and count db.batch calls
// on the way through — the atomicity contract rests on the whole commit
// riding in ONE batch, so the count is asserted below.
const batchCalls = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/db/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db/client")>();
  const { env } = await import("cloudflare:test");
  return {
    ...actual,
    getDb: async () => {
      const db = actual.createDb(env.DB);
      const originalBatch = db.batch.bind(db) as (
        statements: readonly unknown[],
      ) => Promise<unknown>;
      Object.assign(db, {
        batch: (statements: readonly unknown[]) => {
          batchCalls.count++;
          return originalBatch(statements);
        },
      });
      return db;
    },
  };
});

const db = createDb(env.DB);

function importRow(
  climbName: string,
  areaName: string,
  overrides: Partial<NormalizedImportRow> = {},
): NormalizedImportRow {
  return {
    climbName,
    areaName,
    climbTypeHint: null,
    ascentStyle: "redpoint",
    dateSent: "2026-01-10",
    rating: null,
    comment: null,
    gradeText: null,
    blankGradeMeans: "posted-grade",
    gradeFeel: "solid",
    raw: {},
    ...overrides,
  };
}

/** "Bulk Climb 0" … "Bulk Climb 39" (ids 100…139) live in Test Slab Area. */
function bulkRows(from: number, to: number): NormalizedImportRow[] {
  return Array.from({ length: to - from + 1 }, (_, i) =>
    importRow(`Bulk Climb ${from + i}`, "Test Slab Area"),
  );
}

// Seeded once for the whole file (matching the other DB suites); each test
// below uses its own user and its own slice of the bulk climbs, so no test
// depends on another's writes. noop-user's pre-logged send on climb 2 backs
// the already-logged case.
beforeAll(async () => {
  await seedFixtureTree(db);
  await seedManyClimbs(db, 5, 40, 100);
  for (const id of ["import-user", "retry-user", "reval-user", "noop-user"]) {
    await seedFixtureUser(db, { id });
  }
  await seedFixtureSend(db, { userId: "noop-user", climbId: 2, dateSent: null });
});

beforeEach(() => {
  sessionState.userId = "import-user";
  batchCalls.count = 0;
  cacheMocks.revalidatePath.mockClear();
  cacheMocks.refresh.mockClear();
});

describe("importSends atomic commit", () => {
  it("commits a full 25-row batch in a single db.batch and reports the committed count", async () => {
    const result = await importSends(bulkRows(0, 24), "native");

    expect(result).toEqual({
      ok: true,
      value: { imported: 25, alreadyLogged: 0, notFound: [] },
    });
    // One batch total, even though the insert is split into three <=10-row
    // statements (D1's bound-parameter cap) plus 25 climbs updates — the
    // chunks ride inside the same atomic batch.
    expect(batchCalls.count).toBe(1);

    const rows = await db.select().from(sends).where(eq(sends.userId, "import-user")).all();
    expect(rows).toHaveLength(25);
    const climb = await db.select().from(climbs).where(eq(climbs.id, 100)).get();
    expect(climb?.sendCount).toBe(1);
  });

  it("commits nothing when the batch fails partway (no partial import)", async () => {
    // A session user with no `user` row: climb resolution succeeds, then the
    // sends insert violates the user_id foreign key — the kind of failure
    // that used to leave earlier chunks committed while the action reported
    // total failure.
    sessionState.userId = "ghost-user";
    const result = await importSends(bulkRows(25, 36), "native");

    expect(result).toEqual({ ok: false, error: GENERIC_ERROR_MESSAGE });
    expect(await db.select().from(sends).where(eq(sends.userId, "ghost-user")).all()).toHaveLength(0);
    const bulkIds = Array.from({ length: 12 }, (_, i) => 125 + i);
    const touched = await db.select().from(climbs).where(inArray(climbs.id, bulkIds)).all();
    expect(touched.every((c) => c.sendCount === 0)).toBe(true);
    // Nothing committed, so nothing to revalidate.
    expect(cacheMocks.revalidatePath).not.toHaveBeenCalled();
    expect(cacheMocks.refresh).not.toHaveBeenCalled();
  });

  it("skips already-logged sends on a retry instead of duplicating them", async () => {
    sessionState.userId = "retry-user";
    const rows = bulkRows(37, 39);

    const first = await importSends(rows, "native");
    expect(first).toEqual({ ok: true, value: { imported: 3, alreadyLogged: 0, notFound: [] } });

    const second = await importSends(rows, "native");
    expect(second).toEqual({ ok: true, value: { imported: 0, alreadyLogged: 3, notFound: [] } });

    expect(await db.select().from(sends).where(eq(sends.userId, "retry-user")).all()).toHaveLength(3);
    const climb = await db.select().from(climbs).where(eq(climbs.id, 137)).get();
    expect(climb?.sendCount).toBe(1); // not double-counted by the retry
  });
});

describe("importSends revalidation", () => {
  it("revalidates the home page, the user, and every affected climb and area", async () => {
    sessionState.userId = "reval-user";
    // Test Highball = climb 1 in area 4; Test Crimper = climb 3 in area 3.
    const result = await importSends(
      [importRow("Test Highball", "Test Boulders"), importRow("Test Crimper", "Test Sport Wall")],
      "native",
    );
    expect(result.ok).toBe(true);

    const paths = cacheMocks.revalidatePath.mock.calls.map((call) => call[0]);
    expect(new Set(paths)).toEqual(
      new Set(["/", "/users/reval-user", "/climbs/1", "/climbs/3", "/areas/4", "/areas/3"]),
    );
    expect(cacheMocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("revalidates nothing when no rows were written", async () => {
    sessionState.userId = "noop-user";
    const result = await importSends(
      [
        importRow("Test Slab", "Test Slab Area"), // already logged (seeded above)
        importRow("Ghost Climb", "Nowhere"), // not found
      ],
      "native",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.imported).toBe(0);
      expect(result.value.alreadyLogged).toBe(1);
      expect(result.value.notFound).toHaveLength(1);
      expect(result.value.notFound[0].reason).toBe("climb-not-found");
    }
    expect(cacheMocks.revalidatePath).not.toHaveBeenCalled();
    expect(cacheMocks.refresh).not.toHaveBeenCalled();
  });
});
