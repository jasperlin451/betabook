import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { createDb } from "@/db/client";
import { climbs, sends } from "@/db/schema";
import { deleteAccountSends } from "@/lib/account";
import { seedFixtureSend, seedFixtureTree, seedFixtureUser } from "@/test/fixtures";

const db = createDb(env.DB);

beforeAll(async () => {
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: "account-test-user-a" });
  await seedFixtureUser(db, { id: "account-test-user-b" });
  // Climb 1 (Test Highball) gets a send from each user, so deleting one
  // account's sends can be checked against the other's surviving untouched.
  await seedFixtureSend(db, {
    userId: "account-test-user-a",
    climbId: 1,
    dateSent: "2026-01-01",
    rating: 4,
  });
  await seedFixtureSend(db, {
    userId: "account-test-user-b",
    climbId: 1,
    dateSent: "2026-01-02",
    rating: 5,
  });
});

describe("deleteAccountSends", () => {
  it("deletes only the given user's sends, letting the aggregate triggers fire", async () => {
    const before = await db.select().from(climbs).where(eq(climbs.id, 1)).get();
    expect(before?.sendCount).toBe(2);
    expect(before?.ratingSum).toBe(9);
    expect(before?.ratingCount).toBe(2);

    await deleteAccountSends(db, "account-test-user-a");

    const aSends = await db
      .select()
      .from(sends)
      .where(eq(sends.userId, "account-test-user-a"))
      .all();
    expect(aSends).toHaveLength(0);

    const bSend = await db
      .select()
      .from(sends)
      .where(eq(sends.userId, "account-test-user-b"))
      .get();
    expect(bSend).toBeDefined();

    // Only user-a's row is gone, so sends_aggregates_ad should have run once
    // (not cascaded away silently) and left user-b's contribution intact.
    const after = await db.select().from(climbs).where(eq(climbs.id, 1)).get();
    expect(after?.sendCount).toBe(1);
    expect(after?.ratingSum).toBe(5);
    expect(after?.ratingCount).toBe(1);
  });

  it("is a no-op for a user with no sends", async () => {
    await expect(deleteAccountSends(db, "account-test-user-a")).resolves.toBeUndefined();
  });
});
