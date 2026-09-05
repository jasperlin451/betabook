import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

import { createDb, type Database } from "@/db/client";
import {
  getJournalCounts,
  getJournalForClimb,
  getJournalPage,
  getJournalSessionsForAnalytics,
  getOpenProjects,
  type JournalOwner,
} from "@/db/queries";
import { DEFAULT_JOURNAL_FILTER } from "@/lib/journal-filter";
import { seedFixtureJournalEntry, seedFixtureTree, seedFixtureUser } from "@/test/fixtures";

let db: Database;

const OWNER_ID = "priv-owner";
const CLIMB = 1; // Test Highball, from seedFixtureTree

function owner(overrides: Partial<JournalOwner> = {}): JournalOwner {
  return { id: OWNER_ID, isPrivate: false, journalVisibility: "private", ...overrides };
}

beforeAll(async () => {
  db = createDb(env.DB);
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: OWNER_ID, name: "Private Owner" });
  await seedFixtureJournalEntry(db, {
    userId: OWNER_ID,
    climbId: CLIMB,
    entryDate: "2026-02-01",
    body: "Nobody else's business.",
  });
});

const expectedEntry = {
  id: 1,
  climbId: CLIMB,
  kind: "session",
  sent: false,
  isAscent: false,
  entryDate: "2026-02-01",
  body: "Nobody else's business.",
  tags: [],
  climbName: "Test Highball",
  climbType: "boulder",
  climbGrade: 5,
  areaId: 4,
  areaName: "Test Highball Alcove",
};

const GATED_READS = [
  {
    name: "getJournalPage",
    read: (o: JournalOwner, viewerId: string | null) =>
      getJournalPage(db, o, viewerId, DEFAULT_JOURNAL_FILTER),
    visible: { entries: [expectedEntry], hasMore: false, nextCursor: null },
    empty: { entries: [], hasMore: false, nextCursor: null },
  },
  {
    name: "getJournalForClimb",
    read: (o: JournalOwner, viewerId: string | null) => getJournalForClimb(db, o, viewerId, CLIMB),
    visible: [expectedEntry],
    empty: [],
  },
  {
    name: "getOpenProjects",
    read: (o: JournalOwner, viewerId: string | null) => getOpenProjects(db, o, viewerId),
    visible: [
      {
        climbId: CLIMB,
        climbName: "Test Highball",
        climbType: "boulder",
        climbGrade: 5,
        areaId: 4,
        areaName: "Test Highball Alcove",
        sessionCount: 1,
        firstSession: "2026-02-01",
        lastSession: "2026-02-01",
      },
    ],
    empty: [],
  },
  {
    name: "getJournalSessionsForAnalytics",
    read: (o: JournalOwner, viewerId: string | null) =>
      getJournalSessionsForAnalytics(db, o, viewerId),
    visible: [{ entryDate: "2026-02-01", climbType: "boulder", count: 1 }],
    empty: [],
  },
  {
    name: "getJournalCounts",
    read: (o: JournalOwner, viewerId: string | null) =>
      getJournalCounts(db, o, viewerId, "2026-02"),
    visible: {
      entries: 1,
      sessions: 1,
      training: 0,
      days: 1,
      entriesThisMonth: 1,
      daysThisMonth: 1,
      sentThisMonth: 0,
    },
    empty: {
      entries: 0,
      sessions: 0,
      training: 0,
      days: 0,
      entriesThisMonth: 0,
      daysThisMonth: 0,
      sentThisMonth: 0,
    },
  },
] as const;

describe.each(GATED_READS)("$name", ({ read, empty, visible }) => {
  it("returns nothing to a signed-out visitor while the journal is private", async () => {
    expect(await read(owner(), null)).toEqual(empty);
  });

  it("returns nothing to another climber while the journal is private", async () => {
    expect(await read(owner(), "someone-else")).toEqual(empty);
  });

  it("returns nothing to another climber when the whole profile is private", async () => {
    expect(
      await read(owner({ isPrivate: true, journalVisibility: "public" }), "someone-else"),
    ).toEqual(empty);
  });

  it("returns the journal to its owner", async () => {
    expect(await read(owner(), OWNER_ID)).toEqual(visible);
  });

  it("returns a public journal to anyone", async () => {
    expect(await read(owner({ journalVisibility: "public" }), null)).toEqual(visible);
  });
});
