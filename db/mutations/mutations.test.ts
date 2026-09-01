import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { createDb } from "@/db/client";
import { climbs, sends } from "@/db/schema";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/action-result";
import { seedFixtureSend, seedFixtureTree, seedFixtureUser } from "@/test/fixtures";
import {
  createClimb,
  createSend,
  deleteClimb,
  updateClimb,
  updateSend,
} from "@/db/mutations";

/** The action boundary must never throw — Next.js redacts uncaught
 * server-action errors in production, so these tests pin the structured
 * ActionResult contract: user-facing messages come back as { ok: false }. */

const sessionState = vi.hoisted(() => ({ userId: "test-user" as string | null }));

vi.mock("next/cache", () => ({
  refresh: () => {},
  revalidatePath: () => {},
}));

// The real lib/session.ts pulls in next/headers and the whole auth stack,
// neither of which runs outside a Next request — stub the session itself and
// keep throwing the real NotSignedInError so the boundary mapping is
// exercised for real.
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

// Point the actions' getDb/getDbAndContext at the test D1 binding instead of
// the OpenNext Cloudflare context (which only exists in a deployed worker).
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

function sendFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields: Record<string, string> = {
    ascentStyle: "redpoint",
    dateSent: "2026-01-15",
    comment: "",
    rating: "",
    suggestedGrade: "5",
    gradeFeel: "solid",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

// Seeded once for the whole file (matching the other DB suites); each test
// below targets distinct rows so no test depends on another's writes.
// Climb 1 (Test Highball) carries the pre-logged send.
beforeAll(async () => {
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: "test-user" });
  await seedFixtureSend(db, { userId: "test-user", climbId: 1, dateSent: "2026-01-01" });
});

beforeEach(() => {
  sessionState.userId = "test-user";
});

describe("createSend action boundary", () => {
  it("returns ok:false with the validation message instead of throwing", async () => {
    const result = await createSend(2, sendFormData({ ascentStyle: "yolo" }));
    expect(result).toEqual({ ok: false, error: "Invalid ascent style" });
    expect(await db.select().from(sends).where(eq(sends.climbId, 2)).all()).toHaveLength(0);
  });

  it("returns ok:false with the duplicate-send message", async () => {
    const result = await createSend(1, sendFormData());
    expect(result).toEqual({
      ok: false,
      error: "You've already sent this climb — edit your existing send instead.",
    });
  });

  it("returns ok:false with the friendly session message when signed out", async () => {
    sessionState.userId = null;
    const result = await createSend(2, sendFormData());
    expect(result).toEqual({ ok: false, error: SESSION_EXPIRED_MESSAGE });
  });

  it("returns ok:true and writes the send on valid input", async () => {
    const result = await createSend(3, sendFormData({ rating: "4" }));
    expect(result).toEqual({ ok: true, value: undefined });

    const row = await db.select().from(sends).where(eq(sends.climbId, 3)).get();
    expect(row?.userId).toBe("test-user");
    const climb = await db.select().from(climbs).where(eq(climbs.id, 3)).get();
    expect(climb?.sendCount).toBe(1);
    expect(climb?.ratingSum).toBe(4);
  });
});

describe("updateSend action boundary", () => {
  // Climb 4 is this describe's alone — re-seeded per test, per the
  // one-test-one-row convention above.
  async function seedSend(dateSent: string | null): Promise<number> {
    await db.delete(sends).where(eq(sends.climbId, 4));
    await seedFixtureSend(db, { userId: "test-user", climbId: 4, dateSent });
    const row = await db.select().from(sends).where(eq(sends.climbId, 4)).get();
    return row!.id;
  }

  // drizzle's .set() drops `undefined` keys, so a dateSent gone missing from
  // validateSendInput's result would make this clear a silent no-op.
  it("clears the date on a dated send when the form submits a blank date", async () => {
    const sendId = await seedSend("2026-01-15");

    const result = await updateSend(sendId, sendFormData({ dateSent: "" }));
    expect(result).toEqual({ ok: true, value: undefined });

    const row = await db.select().from(sends).where(eq(sends.id, sendId)).get();
    expect(row?.dateSent).toBeNull();
  });

  it("sets a date on a previously undated send", async () => {
    const sendId = await seedSend(null);

    const result = await updateSend(sendId, sendFormData({ dateSent: "2026-02-20" }));
    expect(result).toEqual({ ok: true, value: undefined });

    const row = await db.select().from(sends).where(eq(sends.id, sendId)).get();
    expect(row?.dateSent).toBe("2026-02-20");
  });

  it("leaves the rest of the send intact when only the date is cleared", async () => {
    const sendId = await seedSend("2026-01-15");

    const result = await updateSend(
      sendId,
      sendFormData({ dateSent: "", rating: "5", comment: "Classic" }),
    );
    expect(result).toEqual({ ok: true, value: undefined });

    const row = await db.select().from(sends).where(eq(sends.id, sendId)).get();
    expect(row?.dateSent).toBeNull();
    expect(row?.rating).toBe(5);
    expect(row?.comment).toBe("Classic");
    expect(row?.ascentStyle).toBe("redpoint");
  });

  it("rejects a malformed date without touching the stored one", async () => {
    const sendId = await seedSend("2026-01-15");

    const result = await updateSend(sendId, sendFormData({ dateSent: "15/01/2026" }));
    expect(result).toEqual({ ok: false, error: "Invalid send date" });

    const row = await db.select().from(sends).where(eq(sends.id, sendId)).get();
    expect(row?.dateSent).toBe("2026-01-15");
  });
});

describe("deleteClimb action boundary", () => {
  it("returns ok:false when the climb has logged sends", async () => {
    const result = await deleteClimb(1);
    expect(result).toEqual({ ok: false, error: "Can't delete a climb with logged sends" });
    expect(await db.select().from(climbs).where(eq(climbs.id, 1)).get()).toBeDefined();
  });

  it("returns ok:false when the climb doesn't exist", async () => {
    expect(await deleteClimb(999)).toEqual({ ok: false, error: "Climb not found" });
  });

  it("returns ok:true and deletes on success", async () => {
    expect(await deleteClimb(2)).toEqual({ ok: true, value: undefined });
    expect(await db.select().from(climbs).where(eq(climbs.id, 2)).get()).toBeUndefined();
  });

  it("keeps sends safe even when a raw delete bypasses the action", async () => {
    await expect(db.delete(climbs).where(eq(climbs.id, 1))).rejects.toThrow();
    expect(await db.select().from(climbs).where(eq(climbs.id, 1)).get()).toBeDefined();
    expect(await db.select().from(sends).where(eq(sends.climbId, 1)).get()).toBeDefined();
  });
});

describe("updateClimb discipline invariant", () => {
  it("rejects changing the discipline after a send exists", async () => {
    const formData = new FormData();
    formData.set("name", "Test Highball");
    formData.set("type", "sport");
    formData.set("grade", "5");
    formData.set("description", "");

    expect(await updateClimb(1, formData)).toEqual({
      ok: false,
      error: "Can't change discipline once a climb has logged sends",
    });
  });

  it("enforces the same rule for writes that bypass the action", async () => {
    await expect(
      db.update(climbs).set({ type: "sport" }).where(eq(climbs.id, 1)),
    ).rejects.toThrow();
    expect((await db.select().from(climbs).where(eq(climbs.id, 1)).get())?.type).toBe(
      "boulder",
    );
  });
});

describe("createClimb action boundary", () => {
  it("returns the new climb id as the ok value", async () => {
    const formData = new FormData();
    formData.set("name", "Boundary Test Climb");
    formData.set("type", "boulder");
    formData.set("grade", "3");
    formData.set("description", "");

    const result = await createClimb(4, formData);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const row = await db.select().from(climbs).where(eq(climbs.id, result.value)).get();
      expect(row?.name).toBe("Boundary Test Climb");
    }
  });

  it("returns ok:false with the validation message on a missing name", async () => {
    const formData = new FormData();
    formData.set("name", "   ");
    formData.set("type", "boulder");
    formData.set("grade", "3");
    formData.set("description", "");

    expect(await createClimb(4, formData)).toEqual({ ok: false, error: "Name is required" });
  });
});
