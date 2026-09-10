import { env } from "cloudflare:test";
import { isValidElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import SearchPage from "@/app/page";
import { AppSearch } from "@/components/search/app-search";
import { createDb } from "@/db/client";
import type { SearchSnapshot, SearchState } from "@/lib/search";
import { seedFixtureTree, seedFixtureUser, seedFixtureSend } from "@/test/fixtures";
import { resetDb } from "@/test/reset-db";

const state = vi.hoisted(() => ({ viewer: null as string | null }));
vi.mock("@/lib/session", () => ({
  getMemberSession: async () => (state.viewer ? { user: { id: state.viewer } } : null),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/components/search/app-search", () => ({ AppSearch: () => null }));
vi.mock("@/db/client", async (original) => {
  const actual = await original<typeof import("@/db/client")>();
  const { env } = await import("cloudflare:test");
  return { ...actual, getDb: async () => actual.createDb(env.DB) };
});
const db = createDb(env.DB);
beforeEach(async () => {
  state.viewer = null;
  await resetDb(db);
  await seedFixtureTree(db);
  await seedFixtureUser(db, { id: "reader" });
  await seedFixtureSend(db, { userId: "reader", climbId: 1, dateSent: "2026-09-01" });
});
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
        /* Search siblings. */
      }
    }
  }
  throw new Error("Search not rendered");
}
it("redirects members from the bare home to their journal", async () => {
  state.viewer = "reader";
  await expect(SearchPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
    "REDIRECT:/users/reader",
  );
});
it.each([{}, { mode: "all", name: "   " }])(
  "keeps anonymous search idle and climbers locked (%j)",
  async (search) => {
    const data = props(await SearchPage({ searchParams: Promise.resolve(search) }));
    expect(
      data.initial.map((section) => [section.kind, section.status, section.page.items]),
    ).toEqual([
      ["climb", "idle", []],
      ["area", "idle", []],
      ["climber", "locked", []],
    ]);
  },
);
it("renders public catalog facts without member data, even with protected URL filters", async () => {
  const data = props(
    await SearchPage({
      searchParams: Promise.resolve({
        mode: "climb",
        name: "Test High",
        grade: "9",
        sort: "rating_desc",
      }),
    }),
  );
  expect(data.initial[0].page.items).toEqual([
    {
      id: "climb-1",
      kind: "climb",
      name: "Test Highball",
      discipline: "boulder",
      grade: 5,
      detail: "Test Crag / Test Boulders / Test Highball Alcove",
      href: "/climbs/1/test-highball",
    },
  ]);
});
it("uses the selected area and authenticated viewer for member results", async () => {
  state.viewer = "reader";
  const data = props(
    await SearchPage({
      searchParams: Promise.resolve({ mode: "climb", name: "Test", areaId: "4" }),
    }),
  );
  expect(data.initialState.area).toMatchObject({ id: "4", name: "Test Highball Alcove" });
  expect(data.initial[0].page.items).toMatchObject([
    { id: "climb-1", grade: 5, discipline: "boulder", context: { sent: true, sendCount: 1 } },
  ]);
});
it("returns only an authentication state for anonymous climber searches", async () => {
  const data = props(
    await SearchPage({ searchParams: Promise.resolve({ mode: "climber", name: "Test" }) }),
  );
  expect(data.initial).toEqual([
    { kind: "climber", page: { items: [], hasMore: false, nextPage: 1 }, status: "locked" },
  ]);
});
