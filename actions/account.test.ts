import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setJournalVisibility, setUserPrivate } from "@/actions";
import { createDb } from "@/db/client";
import { user } from "@/db/schema";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/action-result";
import { seedFixtureUser } from "@/test/fixtures";

const sessionState = vi.hoisted(() => ({ userId: "test-user" as string | null }));

vi.mock("next/cache", () => ({
  refresh: () => {},
  revalidatePath: () => {},
}));

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
  };
});

const db = createDb(env.DB);

beforeAll(async () => {
  await seedFixtureUser(db, { id: "test-user" });
});

beforeEach(() => {
  sessionState.userId = "test-user";
});

describe("setUserPrivate action boundary", () => {
  it("returns ok:false with the friendly session message when signed out", async () => {
    sessionState.userId = null;
    const result = await setUserPrivate(true);
    expect(result).toEqual({ ok: false, error: SESSION_EXPIRED_MESSAGE });
  });

  it("flips the signed-in user's isPrivate flag on", async () => {
    const result = await setUserPrivate(true);
    expect(result).toEqual({ ok: true, value: undefined });

    const row = await db.select().from(user).where(eq(user.id, "test-user")).get();
    expect(row?.isPrivate).toBe(true);
  });

  it("flips the signed-in user's isPrivate flag back off", async () => {
    const result = await setUserPrivate(false);
    expect(result).toEqual({ ok: true, value: undefined });

    const row = await db.select().from(user).where(eq(user.id, "test-user")).get();
    expect(row?.isPrivate).toBe(false);
  });
});

describe("setJournalVisibility action boundary", () => {
  it("requires a signed-in user", async () => {
    sessionState.userId = null;
    const result = await setJournalVisibility("public");
    expect(result).toEqual({ ok: false, error: SESSION_EXPIRED_MESSAGE });
  });

  it("publishes the signed-in user's journal", async () => {
    const result = await setJournalVisibility("public");
    expect(result).toEqual({ ok: true, value: undefined });

    const row = await db.select().from(user).where(eq(user.id, "test-user")).get();
    expect(row?.journalVisibility).toBe("public");
  });

  it("makes the signed-in user's journal private again", async () => {
    const result = await setJournalVisibility("private");
    expect(result).toEqual({ ok: true, value: undefined });

    const row = await db.select().from(user).where(eq(user.id, "test-user")).get();
    expect(row?.journalVisibility).toBe("private");
  });

  it("rejects an invalid visibility", async () => {
    const result = await setJournalVisibility("friends");
    expect(result).toEqual({ ok: false, error: "Invalid journal visibility" });
  });
});
