import { env } from "cloudflare:test";
import { beforeEach, expect, it, vi } from "vitest";

import { saveGoal, deleteGoal } from "@/actions/goals";
import { createDb } from "@/db/client";
import { goals } from "@/db/schema";
import { seedFixtureUser, seedFixtureJournalEntry } from "@/test/fixtures";
import { resetDb } from "@/test/reset-db";

const identity = vi.hoisted(() => ({ id: "owner" as string | null }));
vi.mock("next/cache", () => ({
  refresh: vi.fn<() => void>(),
  revalidatePath: vi.fn<() => void>(),
}));
vi.mock("@/lib/session", async () => {
  const { NotSignedInError } = await import("@/lib/action-result");
  return {
    requireSession: async () => {
      if (!identity.id) throw new NotSignedInError();
      return { user: { id: identity.id } };
    },
  };
});
vi.mock("@/lib/rate-limit", () => ({ allowJournalWrite: async () => true }));
vi.mock("@/db/client", async (original) => {
  const actual = await original<typeof import("@/db/client")>();
  const { env } = await import("cloudflare:test");
  return { ...actual, getDb: async () => actual.createDb(env.DB) };
});
const db = createDb(env.DB);
const input = {
  kind: "training",
  target: 2,
  discipline: null,
  grade: null,
  timeframe: "month",
  repeat: "none",
  endDate: "2026-09-30",
  timezone: "UTC",
};
beforeEach(async () => {
  identity.id = "owner";
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T12:00:00Z"));
  await resetDb(db);
  await seedFixtureUser(db, { id: "owner" });
  await seedFixtureUser(db, { id: "other" });
  vi.useRealTimers();
});
it("uses session ownership and rejects changing or deleting someone else’s goal", async () => {
  const result = await saveGoal(null, input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.error);
  identity.id = "other";
  expect((await saveGoal(result.value, { ...input, target: 5 })).ok).toBe(false);
  expect((await deleteGoal(result.value)).ok).toBe(false);
  expect(await db.select().from(goals)).toMatchObject([{ userId: "owner", target: 2 }]);
  identity.id = null;
  expect((await saveGoal(null, input)).ok).toBe(false);
});
it("enforces the five-active-goal cap atomically, and deletion frees a slot", async () => {
  const results = await Promise.all(Array.from({ length: 6 }, () => saveGoal(null, input)));
  expect(results.filter((r) => r.ok)).toHaveLength(5);
  expect(await db.select().from(goals)).toHaveLength(5);
  const first = results.find((r) => r.ok);
  if (!first?.ok) throw Error("Missing created goal");
  expect((await deleteGoal(first.value)).ok).toBe(true);
  expect((await saveGoal(null, input)).ok).toBe(true);
});
it("rejects invalid grade and recurrence combinations without writing", async () => {
  expect(
    (await saveGoal(null, { ...input, kind: "grade", grade: 100, discipline: "boulder" })).ok,
  ).toBe(false);
  expect((await saveGoal(null, { ...input, kind: "days", repeat: "week" })).ok).toBe(false);
  expect(await db.select().from(goals)).toEqual([]);
});
it("completed nonrecurring goals no longer consume capacity", async () => {
  for (let i = 0; i < 5; i += 1) expect((await saveGoal(null, input)).ok).toBe(true);
  const rows = await db.select().from(goals);
  await seedFixtureJournalEntry(db, {
    userId: "owner",
    kind: "training",
    entryDate: rows[0].startDate,
  });
  await seedFixtureJournalEntry(db, {
    userId: "owner",
    kind: "training",
    entryDate: rows[0].startDate,
  });
  expect((await saveGoal(null, input)).ok).toBe(true);
});

it("preserves earlier weekly targets when an owner edits the recurring goal", async () => {
  const [goal] = await db
    .insert(goals)
    .values({
      userId: "owner",
      kind: "training",
      target: 1,
      timeframe: "week",
      repeat: "week",
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      timezone: "UTC",
    })
    .returning();
  await seedFixtureJournalEntry(db, { userId: "owner", kind: "training", entryDate: "2026-09-01" });
  const result = await saveGoal(goal.id, {
    ...input,
    target: 3,
    timeframe: "week",
    repeat: "week",
  });
  expect(result.ok).toBe(true);
  const { getGoalPage } = await import("@/db/queries/goals");
  const history = await getGoalPage(db, "owner", "owner", "completed");
  expect(history.goals).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ target: 1, progress: 1, periodStart: "2026-08-31" }),
    ]),
  );
  expect((await getGoalPage(db, "owner", "owner", "active")).goals[0]).toMatchObject({
    target: 3,
    progress: 0,
  });
});

it("only accepts a new grade above the owner's earlier best", async () => {
  const { seedFixtureTree, seedFixtureSend } = await import("@/test/fixtures");
  await seedFixtureTree(db);
  await seedFixtureSend(db, { userId: "owner", climbId: 1, dateSent: "2026-01-01" });
  const { getNextGoalGrades } = await import("@/db/queries/goals");
  expect(await getNextGoalGrades(db, "owner", "owner")).toMatchObject({ boulder: 6 });
  expect(await getNextGoalGrades(db, "owner", "other")).toEqual({});
  expect(
    (await saveGoal(null, { ...input, kind: "grade", discipline: "boulder", grade: 2, target: 1 }))
      .ok,
  ).toBe(false);
  expect(
    (await saveGoal(null, { ...input, kind: "grade", discipline: "boulder", grade: 6, target: 1 }))
      .ok,
  ).toBe(true);
});

it("uses and edits an explicit seasonal start date, including existing logs in that range", async () => {
  const { getGoalPage } = await import("@/db/queries/goals");
  await seedFixtureJournalEntry(db, { userId: "owner", kind: "training", entryDate: "2026-05-31" });
  await seedFixtureJournalEntry(db, { userId: "owner", kind: "training", entryDate: "2026-06-02" });
  await seedFixtureJournalEntry(db, { userId: "owner", kind: "training", entryDate: "2026-09-02" });
  const seasonal = {
    ...input,
    target: 10,
    timeframe: "custom",
    startDate: "2026-06-01",
    endDate: "2026-11-30",
  };
  const result = await saveGoal(null, seasonal);
  expect(result.ok).toBe(true);
  if (!result.ok) throw Error(result.error);
  expect((await db.select().from(goals))[0]).toMatchObject({
    startDate: "2026-06-01",
    endDate: "2026-11-30",
  });
  expect(
    (await getGoalPage(db, "owner", "owner", "active", 0, new Date("2026-09-12T12:00:00Z")))
      .goals[0].progress,
  ).toBe(2);
  expect((await saveGoal(result.value, { ...seasonal, startDate: "2026-09-01" })).ok).toBe(true);
  expect(
    (await getGoalPage(db, "owner", "owner", "active", 0, new Date("2026-09-12T12:00:00Z")))
      .goals[0].progress,
  ).toBe(1);
});
it("rejects a reversed seasonal range without writing", async () => {
  expect(
    (
      await saveGoal(null, {
        ...input,
        timeframe: "custom",
        startDate: "2026-12-01",
        endDate: "2026-11-30",
      })
    ).ok,
  ).toBe(false);
  expect(await db.select().from(goals)).toEqual([]);
});

it("allows editing an achieved goal at capacity without allowing reactivation above the limit", async () => {
  await seedFixtureJournalEntry(db, { userId: "owner", kind: "training", entryDate: "2026-09-02" });
  const completed = await saveGoal(null, { ...input, target: 1 });
  expect(completed.ok).toBe(true);
  if (!completed.ok) throw new Error("Expected completed fixture goal");
  for (let i = 0; i < 5; i += 1)
    expect((await saveGoal(null, { ...input, target: 100 })).ok).toBe(true);
  expect((await saveGoal(completed.value, { ...input, target: 1 })).ok).toBe(true);
  expect((await saveGoal(completed.value, { ...input, target: 2 })).ok).toBe(false);
  expect((await db.select().from(goals)).find((goal) => goal.id === completed.value)?.target).toBe(
    1,
  );
});
