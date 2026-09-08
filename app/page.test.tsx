import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SearchPage from "@/app/page";
import { AppSearch } from "@/components/search/app-search";
import { getDb } from "@/db/client";
import { searchAreas, searchClimbs, getClimbersPage, getUserSentClimbIds } from "@/db/queries";
import type { SearchSnapshot, SearchState } from "@/lib/search";
const sessionState = vi.hoisted(() => ({ session: null as { user: { id: string } } | null }));
const mockRedirect = vi.hoisted(() =>
  vi.fn<(url: string) => never>((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect: mockRedirect }));
vi.mock("@/lib/session", () => ({ getSession: async () => sessionState.session }));
vi.mock("@/db/client", () => ({ getDb: vi.fn<() => Promise<unknown>>(async () => ({})) }));
vi.mock("@/components/search/app-search", () => ({ AppSearch: () => null }));
vi.mock("@/db/queries", () => ({
  getAreaBreadcrumbs: vi.fn<typeof import("@/db/queries").getAreaBreadcrumbs>(async () => ({
    4: [{ id: 1, name: "Yosemite" }],
  })),
  getArea: vi.fn<typeof import("@/db/queries").getArea>(async (_db, id) => ({
    id,
    name: "Camp 4",
    parentId: 1,
    description: null,
  })),
  searchClimbs: vi.fn<typeof import("@/db/queries").searchClimbs>(async () => ({
    climbs: [
      {
        id: 7,
        areaId: 4,
        name: "Midnight Lightning",
        type: "boulder",
        grade: 9,
        areaName: "Camp 4",
      },
    ],
    hasNextPage: true,
  })),
  searchAreas: vi.fn<typeof import("@/db/queries").searchAreas>(async () => ({
    areas: [{ id: 4, name: "Camp 4", parentId: 1, description: null, ancestorPath: "Yosemite" }],
    hasNextPage: true,
  })),
  getClimbersPage: vi.fn<typeof import("@/db/queries").getClimbersPage>(async () => ({
    climbers: [{ id: "partner", name: "Climbing Partner", image: null, friendshipStatus: "none" }],
    hasMore: false,
  })),
  getClimbSendStats: vi.fn<typeof import("@/db/queries").getClimbSendStats>(async () => ({
    7: { avgRating: 5, sendCount: 2, avgSuggestedGrade: 9 },
  })),
  getUserSentClimbIds: vi.fn<typeof import("@/db/queries").getUserSentClimbIds>(
    async () => new Set([7]),
  ),
}));
function props(node: ReactNode): {
  initialState: SearchState;
  initial: SearchSnapshot;
  viewerId: string | null;
} {
  for (const child of Array.isArray(node) ? node : [node]) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === AppSearch) return child.props as ReturnType<typeof props>;
    if (child.props.children) {
      try {
        return props(child.props.children);
      } catch {
        /* Keep looking in siblings. */
      }
    }
  }
  throw new Error("App search was not rendered");
}
describe("SearchPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.session = null;
  });
  it("redirects a signed-in bare home before doing search work", async () => {
    sessionState.session = { user: { id: "climber-42" } };
    await expect(SearchPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      "REDIRECT:/users/climber-42",
    );
    expect(getDb).not.toHaveBeenCalled();
  });
  it.each([{}, { mode: "climb" }, { mode: "all", name: "   " }])(
    "keeps search idle before a query without loading climbs (%j)",
    async (params) => {
      const data = props(await SearchPage({ searchParams: Promise.resolve(params) }));
      expect(searchClimbs).not.toHaveBeenCalled();
      expect(searchAreas).not.toHaveBeenCalled();
      expect(getClimbersPage).not.toHaveBeenCalled();
      expect(data.initial).toEqual(
        (params.mode === "climb" ? ["climb"] : ["climb", "area", "climber"]).map((kind) => ({
          kind,
          status: "idle",
          page: { items: [], hasMore: false, nextPage: 1 },
        })),
      );
    },
  );
  it("server renders public query results with real navigation identities", async () => {
    const data = props(
      await SearchPage({ searchParams: Promise.resolve({ mode: "climb", name: "Midnight" }) }),
    );
    expect(data.initialState.category).toBe("climb");
    expect(data.initial[0]).toMatchObject({
      kind: "climb",
      status: "ready",
      page: {
        hasMore: true,
        items: [
          {
            id: "climb-7",
            name: "Midnight Lightning",
            href: "/climbs/7/midnight-lightning",
            detail: "Yosemite / Camp 4",
            context: { sent: false, sendCount: 2 },
          },
        ],
      },
    });
    expect(getUserSentClimbIds).not.toHaveBeenCalled();
  });
  it("passes the exact area identity and authenticated viewer through search loading", async () => {
    sessionState.session = { user: { id: "climber-42" } };
    const data = props(
      await SearchPage({
        searchParams: Promise.resolve({ mode: "climb", name: "Midnight", areaId: "4" }),
      }),
    );
    expect(data.initialState).toMatchObject({
      query: "Midnight",
      area: { id: "4", name: "Camp 4" },
    });
    expect(searchClimbs).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ name: "Midnight", areaId: 4 }),
    );
    expect(getUserSentClimbIds).toHaveBeenCalledWith({}, "climber-42", [7]);
    expect(data.initial[0].page.items[0].context?.sent).toBe(true);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
  it("loads grouped All previews and keeps healthy categories after a partial failure", async () => {
    sessionState.session = { user: { id: "viewer" } };
    vi.mocked(searchAreas).mockRejectedValueOnce(new Error("Unavailable"));
    const data = props(
      await SearchPage({ searchParams: Promise.resolve({ mode: "all", name: "Climbing" }) }),
    );
    expect(data.initial.map((section) => [section.kind, section.status])).toEqual([
      ["climb", "ready"],
      ["area", "error"],
      ["climber", "ready"],
    ]);
    expect(data.initial[2].page.items[0]).toMatchObject({
      name: "Climbing Partner",
      climber: { id: "partner" },
    });
    expect(getClimbersPage).toHaveBeenCalledWith({}, "viewer", { name: "Climbing" });
  });
});
