import { beforeEach, describe, expect, it, vi } from "vitest";

import SearchPage from "@/app/page";

const sessionState = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
}));

const mockRedirect = vi.hoisted(() => vi.fn<(url: string) => void>());

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/session", () => ({
  getSession: vi.fn<() => Promise<{ user: { id: string } } | null>>(
    async () => sessionState.session,
  ),
}));

vi.mock("@/db/client", () => ({
  getDb: vi.fn<() => Promise<unknown>>(async () => ({})),
}));

vi.mock("@/db/queries", () => ({
  getRecentSends: vi.fn<() => Promise<{ sends: []; hasMore: boolean }>>(async () => ({
    sends: [],
    hasMore: false,
  })),
  getAreaBreadcrumbs: vi.fn<() => Promise<Record<string, never>>>(async () => ({})),
  searchClimbs: vi.fn<() => Promise<{ climbs: []; hasNextPage: boolean }>>(async () => ({
    climbs: [],
    hasNextPage: false,
  })),
  countSearchClimbs: vi.fn<() => Promise<number>>(async () => 0),
  searchAreas: vi.fn<() => Promise<{ areas: []; hasNextPage: boolean }>>(async () => ({
    areas: [],
    hasNextPage: false,
  })),
  countSearchAreas: vi.fn<() => Promise<number>>(async () => 0),
  getClimbSendStats: vi.fn<() => Promise<Record<string, never>>>(async () => ({})),
  getUserSentClimbIds: vi.fn<() => Promise<Set<number>>>(async () => new Set<number>()),
}));

vi.mock("next/link", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/app-link", () => ({
  AppLink: () => null,
}));

vi.mock("@/components/search-form", () => ({
  AreaSearchToolbar: () => null,
  ClimbSearchToolbar: () => null,
}));

vi.mock("@/components/search-results", () => ({
  AreaSearchResults: () => null,
  ClimbSearchResults: () => null,
}));

vi.mock("@/components/navigation-pending", () => ({
  NavigationPendingProvider: ({ children }: { children: React.ReactNode }) => children,
  NavigationPendingRegion: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/command-palette", () => ({
  HomeSearchEntry: () => null,
}));

vi.mock("@/components/recent-sends-feed", () => ({
  RecentSendsFeed: () => null,
}));

describe("SearchPage (Landing home)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.session = null;
  });

  it("redirects an authenticated user on the default landing home to their own page", async () => {
    sessionState.session = { user: { id: "climber-42" } };

    await SearchPage({
      searchParams: Promise.resolve({}),
    });

    expect(mockRedirect).toHaveBeenCalledWith("/users/climber-42");
  });

  it("does not redirect an unauthenticated user on the default landing home", async () => {
    sessionState.session = null;

    const result = await SearchPage({
      searchParams: Promise.resolve({}),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it("does not redirect an authenticated user when search parameters are present", async () => {
    sessionState.session = { user: { id: "climber-42" } };

    const result = await SearchPage({
      searchParams: Promise.resolve({ mode: "climb", name: "Midnight Lightning" }),
    });

    expect(mockRedirect).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});
