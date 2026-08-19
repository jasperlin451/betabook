import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Database } from "@/db/client";
import { getSendsForClimb, getSendsForUser, getUserSendForClimb, getUserSentClimbIds } from "./sends";
import { seedFixtureSend, seedFixtureTree, seedFixtureUser } from "@/test/fixtures";

let db: Database;

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);

  await seedFixtureUser(db, { id: "test-user-1", name: "Alice Climber" });
  await seedFixtureUser(db, { id: "test-user-2", name: "Bob Climber" });

  // Test Highball (climb id 1) sent by both users on different dates;
  // Test Slab (climb id 2) sent only by test-user-1.
  await seedFixtureSend(db, {
    userId: "test-user-1",
    climbId: 1,
    dateSent: "2026-01-01",
    rating: 4,
  });
  await seedFixtureSend(db, {
    userId: "test-user-2",
    climbId: 1,
    dateSent: "2026-02-01",
    completionType: "flash",
  });
  await seedFixtureSend(db, {
    userId: "test-user-1",
    climbId: 2,
    dateSent: "2026-03-01",
    completionType: "onsight",
  });
});

describe("getUserSendForClimb", () => {
  it("returns the user's send for a climb they've sent", async () => {
    const send = await getUserSendForClimb(db, "test-user-1", 1);
    expect(send?.rating).toBe(4);
  });

  it("returns undefined when the user hasn't sent that climb", async () => {
    const send = await getUserSendForClimb(db, "test-user-1", 3);
    expect(send).toBeUndefined();
  });
});

describe("getSendsForClimb", () => {
  it("returns every user's send for the climb, newest dateSent first", async () => {
    const results = await getSendsForClimb(db, 1);
    expect(results.map((s) => s.userName)).toEqual(["Bob Climber", "Alice Climber"]);
  });

  it("returns an empty array for a climb with no sends", async () => {
    const results = await getSendsForClimb(db, 3);
    expect(results).toEqual([]);
  });
});

describe("getSendsForUser", () => {
  it("returns every send across a user's climbs, newest dateSent first", async () => {
    const results = await getSendsForUser(db, "test-user-1");
    expect(results.map((s) => s.climbName)).toEqual(["Test Slab", "Test Highball"]);
  });

  it("returns an empty array for a user with no sends", async () => {
    await seedFixtureUser(db, { id: "test-user-3", name: "No Sends" });
    const results = await getSendsForUser(db, "test-user-3");
    expect(results).toEqual([]);
  });
});

describe("getUserSentClimbIds", () => {
  it("returns every climb id the user has sent", async () => {
    const ids = await getUserSentClimbIds(db, "test-user-1");
    expect(ids).toEqual(new Set([1, 2]));
  });

  it("only includes the given user's own sends", async () => {
    const ids = await getUserSentClimbIds(db, "test-user-2");
    expect(ids).toEqual(new Set([1]));
  });

  it("returns an empty set for a user with no sends", async () => {
    await seedFixtureUser(db, { id: "test-user-4", name: "Also No Sends" });
    const ids = await getUserSentClimbIds(db, "test-user-4");
    expect(ids).toEqual(new Set());
  });
});
