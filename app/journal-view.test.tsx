import { describe, expect, it, vi } from "vitest";

import { JournalView } from "@/app/users/[id]/journal-view";
import { DEFAULT_JOURNAL_FILTER } from "@/lib/journal-filter";

const mocks = vi.hoisted(() => ({
  getAreaBreadcrumbs: vi.fn<() => Promise<Record<number, never[]>>>(),
  getClimb: vi.fn<() => Promise<null>>(),
  getJournalCounts: vi.fn<() => Promise<Record<string, number>>>(),
  getJournalPage: vi.fn<() => Promise<{ entries: never[]; hasMore: boolean; nextCursor: null }>>(),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn<() => Promise<Record<string, never>>>(async () => ({})),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn<() => Promise<{ cf: { timezone: string } }>>(async () => ({
    cf: { timezone: "America/Los_Angeles" },
  })),
}));

vi.mock("@/db/queries", () => ({
  getAreaBreadcrumbs: mocks.getAreaBreadcrumbs,
  getClimb: mocks.getClimb,
  getJournalCounts: mocks.getJournalCounts,
  getJournalPage: mocks.getJournalPage,
}));

vi.mock("@/components/journal", () => ({
  JournalFilterToolbar: vi.fn<(props: unknown) => null>(() => null),
  JournalTimeline: vi.fn<(props: unknown) => null>(() => null),
}));

const owner = {
  id: "journal-owner",
  isPrivate: false,
  journalVisibility: "public" as const,
};

describe("JournalView", () => {
  it("loads the timeline and counts without project data", async () => {
    mocks.getAreaBreadcrumbs.mockResolvedValue({});
    mocks.getJournalCounts.mockResolvedValue({
      entries: 1,
      sessions: 1,
      training: 0,
      sent: 0,
      days: 1,
      entriesThisMonth: 1,
      daysThisMonth: 1,
      sentThisMonth: 0,
    });
    mocks.getJournalPage.mockResolvedValue({ entries: [], hasMore: false, nextCursor: null });

    await JournalView({
      owner,
      viewerId: owner.id,
      filter: DEFAULT_JOURNAL_FILTER,
    });

    expect(mocks.getJournalCounts).toHaveBeenCalledTimes(1);
    expect(mocks.getJournalPage).toHaveBeenCalledTimes(1);
    expect(mocks.getAreaBreadcrumbs).toHaveBeenCalledWith({}, []);
  });

  it("omits an empty current-month summary", async () => {
    mocks.getAreaBreadcrumbs.mockResolvedValue({});
    mocks.getJournalCounts.mockResolvedValue({
      entries: 1,
      sessions: 1,
      training: 0,
      sent: 0,
      days: 1,
      entriesThisMonth: 0,
      daysThisMonth: 0,
      sentThisMonth: 0,
    });
    mocks.getJournalPage.mockResolvedValue({ entries: [], hasMore: false, nextCursor: null });

    const result = await JournalView({
      owner,
      viewerId: owner.id,
      filter: DEFAULT_JOURNAL_FILTER,
    });

    const sidebarLayout = result.props.children;
    expect(
      sidebarLayout.props.sidebar.props.cards.map((card: { key: string }) => card.key),
    ).toEqual(["all-time"]);
  });
});
