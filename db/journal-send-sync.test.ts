import { env } from "cloudflare:test";
import { and, eq, sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createDb } from "@/db/client";
import { journalEntries, sends } from "@/db/schema";
import {
  seedFixtureJournalEntry,
  seedFixtureSend,
  seedFixtureTree,
  seedFixtureUser,
} from "@/test/fixtures";

const db = createDb(env.DB);
const USER_ID = "journal-sync-user";
const CLIMB_ID = 1;

beforeAll(async () => {
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: USER_ID, name: "Journal Sync User" });
});

beforeEach(async () => {
  await db.delete(journalEntries).where(eq(journalEntries.userId, USER_ID));
  await db.delete(sends).where(eq(sends.userId, USER_ID));
});

async function expectInvariantViolation(query: Promise<unknown>) {
  const messages: string[] = [];
  try {
    await query;
  } catch (error) {
    for (let current: unknown = error; current instanceof Error; current = current.cause) {
      messages.push(current.message);
    }
  }
  expect(messages.join("\n")).toContain("journal/send invariant:");
}

async function seedAscent() {
  await seedFixtureSend(db, {
    userId: USER_ID,
    climbId: CLIMB_ID,
    dateSent: "2026-03-01",
    comment: "Ascent",
  });
  await seedFixtureJournalEntry(db, {
    userId: USER_ID,
    climbId: CLIMB_ID,
    entryDate: "2026-03-01",
    body: "Ascent",
    sent: true,
  });
}

describe("journal and send database invariants", () => {
  it("rejects a sent entry without a matching dated send", async () => {
    await expectInvariantViolation(
      seedFixtureJournalEntry(db, {
        userId: USER_ID,
        climbId: CLIMB_ID,
        entryDate: "2026-03-01",
        sent: true,
      }),
    );
  });

  it("rejects a repeat before the ascent date", async () => {
    await seedAscent();

    await expectInvariantViolation(
      seedFixtureJournalEntry(db, {
        userId: USER_ID,
        climbId: CLIMB_ID,
        entryDate: "2026-02-28",
        sent: true,
      }),
    );
  });

  it("moves the mirrored entry before updating the send", async () => {
    await seedAscent();
    const ascent = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(eq(journalEntries.userId, USER_ID))
      .get();

    await db.batch([
      db
        .update(journalEntries)
        .set({ entryDate: "2026-02-15", body: "Moved" })
        .where(eq(journalEntries.id, ascent!.id)),
      db
        .update(sends)
        .set({ dateSent: "2026-02-15", comment: "Moved" })
        .where(and(eq(sends.userId, USER_ID), eq(sends.climbId, CLIMB_ID))),
    ]);

    const send = await db.select().from(sends).where(eq(sends.userId, USER_ID)).get();
    expect(send).toMatchObject({ dateSent: "2026-02-15", comment: "Moved" });
  });

  it("rolls back an ascent move past a repeat", async () => {
    await seedAscent();
    await seedFixtureJournalEntry(db, {
      userId: USER_ID,
      climbId: CLIMB_ID,
      entryDate: "2026-04-01",
      body: "Repeat",
      sent: true,
    });
    const ascent = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(and(eq(journalEntries.userId, USER_ID), eq(journalEntries.entryDate, "2026-03-01")))
      .get();

    await expectInvariantViolation(
      db.batch([
        db
          .update(journalEntries)
          .set({ entryDate: "2026-05-01" })
          .where(eq(journalEntries.id, ascent!.id)),
        db
          .update(sends)
          .set({ dateSent: "2026-05-01" })
          .where(and(eq(sends.userId, USER_ID), eq(sends.climbId, CLIMB_ID))),
      ]),
    );

    const send = await db.select().from(sends).where(eq(sends.userId, USER_ID)).get();
    const entry = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, ascent!.id))
      .get();
    expect(send?.dateSent).toBe("2026-03-01");
    expect(entry?.entryDate).toBe("2026-03-01");
  });

  it("clears sent flags when the corresponding send is deleted", async () => {
    await seedAscent();

    await db.delete(sends).where(and(eq(sends.userId, USER_ID), eq(sends.climbId, CLIMB_ID)));

    const entry = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, USER_ID))
      .get();
    expect(entry?.sent).toBe(false);
  });
});

describe("0028 reconciliation", () => {
  it("backfills sends created after the original backfill ran", async () => {
    await seedFixtureSend(db, {
      userId: USER_ID,
      climbId: CLIMB_ID,
      dateSent: "2026-06-01",
      comment: "Created between deployments",
    });
    const migration = env.TEST_MIGRATIONS.find((item) =>
      item.name.startsWith("0028_enforce_journal_send_sync"),
    );
    if (!migration) throw new Error("0028_enforce_journal_send_sync.sql is missing");

    await db.run(sql.raw(migration.queries[0]));
    await db.run(sql.raw(migration.queries[0]));

    const entries = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, USER_ID));
    expect(entries).toMatchObject([
      {
        climbId: CLIMB_ID,
        entryDate: "2026-06-01",
        body: "Created between deployments",
        sent: true,
      },
    ]);
  });
});
