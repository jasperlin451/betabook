import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { buildSendInsert, isSendClimbGuardFailure } from "@/actions/send-statements";
import { createDb, type Database } from "@/db/client";
import { climbs, journalEntries, sends } from "@/db/schema";
import type { SendInput } from "@/lib/sends";
import { seedFixtureTree, seedFixtureUser } from "@/test/fixtures";

let db: Database;

const HIGHBALL = 1; // boulder
const CRIMPER = 3; // sport

const INPUT: SendInput = {
  ascentStyle: "redpoint",
  dateSent: "2026-03-01",
  comment: null,
  rating: 4,
  suggestedGrade: 5,
  gradeFeel: "solid",
};

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: "stmt-user", name: "Statement User" });
});

describe("buildSendInsert", () => {
  it("inserts the send and returns its id", async () => {
    const inserted = await buildSendInsert(db, {
      userId: "stmt-user",
      climbId: HIGHBALL,
      climbType: "boulder",
      input: INPUT,
    });

    expect(inserted).toHaveLength(1);
    const send = await db.select().from(sends).where(eq(sends.id, inserted[0].id)).get();
    expect(send).toMatchObject({ climbId: HIGHBALL, ascentStyle: "redpoint", rating: 4 });
  });

  it("refuses to write against a climb of a different discipline", async () => {
    const messages: string[] = [];
    try {
      await buildSendInsert(db, {
        userId: "stmt-user",
        climbId: CRIMPER,
        climbType: "boulder", // stale: CRIMPER is a sport route
        input: INPUT,
      });
    } catch (error) {
      for (let e: unknown = error; e instanceof Error; e = e.cause) messages.push(e.message);
    }
    expect(messages.join("\n")).toContain("NOT NULL constraint failed: sends.climb_id");
    expect(
      isSendClimbGuardFailure(new Error("wrapper", { cause: new Error(messages.at(-1)) })),
    ).toBe(true);
    expect(await db.select().from(sends).where(eq(sends.climbId, CRIMPER)).get()).toBeUndefined();
  });

  it("can ride in a db.batch, and takes the batch down with it when guarded", async () => {
    await db.batch([
      db.insert(journalEntries).values({
        userId: "stmt-user",
        climbId: CRIMPER,
        kind: "session",
        entryDate: "2026-03-02",
      }),
      buildSendInsert(db, {
        userId: "stmt-user",
        climbId: CRIMPER,
        climbType: "sport",
        input: { ...INPUT, suggestedGrade: 10 },
      }),
    ]);
    expect(await db.select().from(sends).where(eq(sends.climbId, CRIMPER)).get()).toBeDefined();

    const before = await db.select().from(journalEntries);
    await expect(
      db.batch([
        db.insert(journalEntries).values({
          userId: "stmt-user",
          climbId: 4,
          kind: "session",
          entryDate: "2026-03-03",
        }),
        buildSendInsert(db, {
          userId: "stmt-user",
          climbId: 4, // Test Crack, a trad route
          climbType: "boulder",
          input: INPUT,
        }),
      ]),
    ).rejects.toThrow(/NOT NULL constraint failed/);

    expect(await db.select().from(journalEntries)).toHaveLength(before.length);
  });

  it("leaves the climb aggregates to the triggers", async () => {
    const before = await db.select().from(climbs).where(eq(climbs.id, 2)).get();

    await buildSendInsert(db, {
      userId: "stmt-user",
      climbId: 2,
      climbType: "boulder",
      input: INPUT,
    });

    const after = await db.select().from(climbs).where(eq(climbs.id, 2)).get();
    expect(after).toMatchObject({
      sendCount: (before?.sendCount ?? 0) + 1,
      ratingSum: (before?.ratingSum ?? 0) + 4,
      ratingCount: (before?.ratingCount ?? 0) + 1,
    });
  });
});
