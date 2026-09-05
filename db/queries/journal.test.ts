import { env } from "cloudflare:test";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { createDb, type Database } from "@/db/client";
import {
  getAscentEntryId,
  getJournalCounts,
  getJournalEntry,
  getJournalForClimb,
  getJournalPage,
  getJournalSessionsForAnalytics,
  getOpenProjects,
  type JournalOwner,
} from "@/db/queries";
import { DEFAULT_JOURNAL_FILTER, type JournalFilter } from "@/lib/journal-filter";
import {
  seedFixtureJournalEntry,
  seedFixtureSend,
  seedFixtureTree,
  seedFixtureUser,
} from "@/test/fixtures";

let db: Database;

const OWNER: JournalOwner = { id: "tl-owner", isPrivate: false, journalVisibility: "private" };

const HIGHBALL = 1; // from seedFixtureTree
const SLAB = 2;
const CRIMPER = 3;

function filter(overrides: Partial<JournalFilter> = {}): JournalFilter {
  return { ...DEFAULT_JOURNAL_FILTER, ...overrides };
}

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: OWNER.id, name: "Timeline Owner" });
  await seedFixtureUser(db, { id: "tl-other", name: "Someone Else" });

  await seedFixtureSend(db, {
    userId: OWNER.id,
    climbId: HIGHBALL,
    dateSent: "2025-01-10",
    comment: "Finally. 100% effort under_score.",
  });

  await seedFixtureJournalEntry(db, {
    userId: OWNER.id,
    climbId: HIGHBALL,
    entryDate: "2025-01-10",
    sent: true,
    isAscent: true,
    body: "Finally. 100% effort under_score.",
  });
  await seedFixtureJournalEntry(db, {
    userId: OWNER.id,
    climbId: HIGHBALL,
    entryDate: "2025-02-02",
    sent: true,
  });
  await seedFixtureJournalEntry(db, {
    userId: OWNER.id,
    climbId: HIGHBALL,
    entryDate: "2025-02-02",
  });
  await seedFixtureJournalEntry(db, { userId: OWNER.id, climbId: SLAB, entryDate: "2025-03-05" });
  await seedFixtureJournalEntry(db, { userId: OWNER.id, climbId: SLAB, entryDate: "2025-03-06" });
  await seedFixtureJournalEntry(db, {
    userId: OWNER.id,
    entryDate: "2025-04-01",
    kind: "training",
    body: "Hangboard.",
    tags: ["hangboard", "happy-boulders"],
  });
  await seedFixtureJournalEntry(db, {
    userId: OWNER.id,
    entryDate: "2026-01-15",
    kind: "training",
    body: "Gym laps.",
  });

  await seedFixtureSend(db, { userId: "tl-other", climbId: CRIMPER, dateSent: "2026-02-01" });
  await seedFixtureJournalEntry(db, {
    userId: "tl-other",
    climbId: CRIMPER,
    entryDate: "2026-02-01",
    sent: true,
  });
});

describe("getJournalPage", () => {
  it("returns one user's entries, newest first", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter());
    expect(page.entries.map((e) => e.entryDate)).toEqual([
      "2026-01-15",
      "2025-04-01",
      "2025-03-06",
      "2025-03-05",
      "2025-02-02",
      "2025-02-02",
      "2025-01-10",
    ]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("labels only the earliest sent session on a climb as the ascent", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ climbId: HIGHBALL }));
    expect(
      page.entries.filter((entry) => entry.sent).map((e) => [e.entryDate, e.isAscent]),
    ).toEqual([
      ["2025-02-02", false],
      ["2025-01-10", true],
    ]);
  });

  it("keeps indoor climbing as training without a climb", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter());
    const gymDay = page.entries.find((e) => e.entryDate === "2026-01-15");
    expect(gymDay).toMatchObject({
      kind: "training",
      climbId: null,
      climbName: null,
      areaName: null,
    });
  });

  it("joins the climb and area onto an attached entry", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ climbId: HIGHBALL }));
    expect(page.entries[0]).toMatchObject({
      climbName: "Test Highball",
      climbType: "boulder",
      areaName: "Test Highball Alcove",
    });
  });

  it("decodes tags, and gives an untagged entry an empty array", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ view: "training" }));
    expect(page.entries.find((entry) => entry.entryDate === "2025-04-01")?.tags).toEqual([
      "hangboard",
      "happy-boulders",
    ]);

    const sessions = await getJournalPage(db, OWNER, OWNER.id, filter({ view: "sessions" }));
    expect(sessions.entries[0]?.tags).toEqual([]);
  });

  it("filters by a hyphenated tag", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ tag: "happy-boulders" }));
    expect(page.entries.map((e) => e.entryDate)).toEqual(["2025-04-01"]);
  });

  it("returns nothing for a tag nobody used", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ tag: "campus" }));
    expect(page.entries).toEqual([]);
  });

  it.each([
    ["highball", "2025-01-10"],
    ["alcove", "2025-01-10"],
    ["finally", "2025-01-10"],
    ["hangboard", "2025-04-01"],
  ])("searches route, area, note, and tag text for %s", async (query, entryDate) => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ query }));
    expect(page.entries.some((entry) => entry.entryDate === entryDate)).toBe(true);
  });

  it.each(["boulders", "crag"])("searches ancestor area names for %s", async (query) => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ query, view: "sessions" }));
    expect(page.entries).toHaveLength(5);
    expect(page.entries.every((entry) => entry.kind === "session")).toBe(true);
  });

  it.each(["%", "_"])("treats %s as literal search text", async (query) => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ query }));
    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]).toMatchObject({ entryDate: "2025-01-10" });
  });

  it("accepts a multibyte query without creating an oversized LIKE pattern", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ query: "é".repeat(100) }));
    expect(page.entries).toEqual([]);
  });

  it("filters by year", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ year: 2026 }));
    expect(page.entries.map((e) => e.entryDate)).toEqual(["2026-01-15"]);
  });

  it("pages by cursor without repeating or skipping a same-day pair", async () => {
    const first = await getJournalPage(db, OWNER, OWNER.id, filter(), null, 4);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toEqual({ entryDate: "2025-03-05", id: first.entries[3].id });

    const second = await getJournalPage(db, OWNER, OWNER.id, filter(), first.nextCursor, 4);
    const ids = [...first.entries, ...second.entries].map((e) => e.id);
    expect(new Set(ids).size).toBe(7);
    expect(second.hasMore).toBe(false);
  });

  it("carries the cursor through a filter", async () => {
    const first = await getJournalPage(db, OWNER, OWNER.id, filter({ view: "sessions" }), null, 1);
    expect(first.entries.map((e) => e.entryDate)).toEqual(["2025-03-06"]);

    const second = await getJournalPage(
      db,
      OWNER,
      OWNER.id,
      filter({ view: "sessions" }),
      first.nextCursor,
      1,
    );
    expect(second.entries.map((e) => e.entryDate)).toEqual(["2025-03-05"]);
  });
});

describe("getJournalForClimb", () => {
  it("returns the owner's history on one climb, newest first", async () => {
    const entries = await getJournalForClimb(db, OWNER, OWNER.id, HIGHBALL);
    expect(entries).toHaveLength(3);
    expect(entries.at(-1)).toMatchObject({ entryDate: "2025-01-10", isAscent: true });
  });

  it("honours its limit", async () => {
    const entries = await getJournalForClimb(db, OWNER, OWNER.id, HIGHBALL, 1);
    expect(entries).toHaveLength(1);
  });

  it("is empty for a climb with no entries", async () => {
    expect(await getJournalForClimb(db, OWNER, OWNER.id, CRIMPER)).toEqual([]);
  });
});

describe("getJournalEntry", () => {
  it("returns the owner's own entry", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ year: 2026 }));
    const entry = await getJournalEntry(db, page.entries[0].id, OWNER.id);
    expect(entry).toMatchObject({ body: "Gym laps." });
  });

  it("returns nothing for somebody else's entry, without a second check", async () => {
    const page = await getJournalPage(db, OWNER, OWNER.id, filter({ year: 2026 }));
    expect(await getJournalEntry(db, page.entries[0].id, "tl-other")).toBeUndefined();
  });
});

describe("getAscentEntryId", () => {
  it("returns the explicitly recorded ascent", async () => {
    const entries = await getJournalForClimb(db, OWNER, OWNER.id, HIGHBALL);
    const ascent = entries.find((e) => e.isAscent);
    expect(await getAscentEntryId(db, OWNER.id, HIGHBALL)).toBe(ascent?.id);
  });

  it("is undefined for a climb with sessions but no send", async () => {
    expect(await getAscentEntryId(db, OWNER.id, SLAB)).toBeUndefined();
  });

  it("is scoped to one climber", async () => {
    expect(await getAscentEntryId(db, "tl-other", HIGHBALL)).toBeUndefined();
  });
});

describe("getJournalCounts", () => {
  it("counts entries, kinds, sends and distinct outdoor-session days", async () => {
    const counts = await getJournalCounts(db, OWNER, OWNER.id, "2026-01");
    expect(counts).toMatchObject({
      entries: 7,
      sessions: 5,
      training: 2,
      days: 4,
      entriesThisMonth: 1,
      daysThisMonth: 0,
      sentThisMonth: 0,
    });
  });

  it("moves with the month it is asked about", async () => {
    const counts = await getJournalCounts(db, OWNER, OWNER.id, "2025-02");
    expect(counts).toMatchObject({ entriesThisMonth: 2, daysThisMonth: 1, sentThisMonth: 1 });
  });

  it("does not count training as a day out", async () => {
    const counts = await getJournalCounts(db, OWNER, OWNER.id, "2025-04");
    expect(counts).toMatchObject({ entriesThisMonth: 1, daysThisMonth: 0 });
  });
});

describe("getJournalSessionsForAnalytics", () => {
  it("returns only outdoor sessions associated with climbs", async () => {
    const sessions = await getJournalSessionsForAnalytics(db, OWNER, OWNER.id);

    expect(sessions).toHaveLength(4);
    expect(sessions.reduce((total, session) => total + session.count, 0)).toBe(5);
    expect(sessions.find((session) => session.entryDate === "2025-02-02")?.count).toBe(2);
    expect(sessions.every((session) => session.climbType !== null)).toBe(true);
    expect(sessions.some((session) => session.entryDate === "2026-01-15")).toBe(false);
    expect(sessions.some((session) => session.entryDate === "2025-04-01")).toBe(false);
  });
});

describe("getOpenProjects", () => {
  it("returns climbs with sessions and no send", async () => {
    const projects = await getOpenProjects(db, OWNER, OWNER.id);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      climbId: SLAB,
      climbName: "Test Slab",
      areaName: "Test Slab Area",
      sessionCount: 2,
      firstSession: "2025-03-05",
      lastSession: "2025-03-06",
    });
  });

  it("drops a climb once it is sent — nothing has to be marked done", async () => {
    await seedFixtureSend(db, { userId: OWNER.id, climbId: SLAB, dateSent: "2025-03-07" });
    expect(await getOpenProjects(db, OWNER, OWNER.id)).toEqual([]);
  });

  it("orders equal-date projects by climb id", async () => {
    const owner = {
      id: "tl-project-order",
      isPrivate: false,
      journalVisibility: "private" as const,
    };
    await seedFixtureUser(db, { id: owner.id });
    await seedFixtureJournalEntry(db, {
      userId: owner.id,
      climbId: 4,
      entryDate: "2025-05-01",
    });
    await seedFixtureJournalEntry(db, {
      userId: owner.id,
      climbId: SLAB,
      entryDate: "2025-05-01",
    });

    const projects = await getOpenProjects(db, owner, owner.id);
    expect(projects.map(({ climbId }) => climbId)).toEqual([SLAB, 4]);
  });

  it("bounds the number of projects returned", async () => {
    const owner = {
      id: "tl-project-limit",
      isPrivate: false,
      journalVisibility: "private" as const,
    };
    await seedFixtureUser(db, { id: owner.id });
    await seedFixtureJournalEntry(db, {
      userId: owner.id,
      climbId: SLAB,
      entryDate: "2025-06-01",
    });
    await seedFixtureJournalEntry(db, {
      userId: owner.id,
      climbId: 4,
      entryDate: "2025-06-02",
    });

    const projects = await getOpenProjects(db, owner, owner.id, 1);
    expect(projects).toHaveLength(1);
    expect(projects[0]?.climbId).toBe(4);
  });
});

describe("the timeline's query plan", () => {
  it("seeks journal_user_date_idx and does not sort", async () => {
    const plan = await db.all<{ detail: string }>(sql`
      EXPLAIN QUERY PLAN
      SELECT j.id FROM journal_entries j
      WHERE j.user_id = ${OWNER.id} AND (j.entry_date, j.id) < ('2026-01-01', 1)
      ORDER BY j.entry_date DESC, j.id DESC
      LIMIT 21
    `);
    const detail = plan.map((row) => row.detail).join("\n");
    expect(detail).toContain("journal_user_date_idx");
    expect(detail).not.toContain("TEMP B-TREE");
  });
});
