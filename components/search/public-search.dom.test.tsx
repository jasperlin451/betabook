import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { SearchController } from "@/components/search/search-controller";
import { DEFAULT_BOULDER_RANGE } from "@/lib/filters/discipline-filter";
import { EMPTY_SEARCH, searchHref } from "@/lib/search";

vi.mock("next/link", () => ({
  default: ({
    children,
    prefetch: _prefetch,
    ...props
  }: React.ComponentProps<"a"> & { prefetch?: boolean }) => <a {...props}>{children}</a>,
}));
afterEach(() => vi.unstubAllGlobals());
function requestUrl(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : input.toString();
}
function Search({ publicOnly = true, quick = false }: { publicOnly?: boolean; quick?: boolean }) {
  const [state, setState] = useState({ ...EMPTY_SEARCH, query: "Test" });
  return (
    <SearchController
      publicOnly={publicOnly}
      quick={quick}
      state={state}
      onChange={setState}
      onNavigate={() => {}}
      onExpand={() => {}}
      resultHref={(item) => item.href}
    />
  );
}
it("shows public grades from catalog endpoints and keeps climber discovery locked", async () => {
  const transport = vi.fn<typeof fetch>(async (url) =>
    requestUrl(url).includes("/climbs?")
      ? Response.json({
          climbs: [
            {
              id: 1,
              name: "Test route",
              areaId: 2,
              areaName: "Test area",
              grade: 5,
              type: "boulder",
              description: "A route.",
            },
          ],
          areaBreadcrumbs: {},
          hasNextPage: false,
        })
      : Response.json({ areas: [], hasNextPage: false }),
  );
  vi.stubGlobal("fetch", transport);
  const user = userEvent.setup();
  render(<Search />);
  expect(await screen.findByRole("link", { name: "Open Test route, Test area" })).toBeVisible();
  expect(screen.getByText("V4")).toBeVisible();
  expect(screen.getByText("Boulder")).toBeVisible();
  expect(transport.mock.calls).toHaveLength(2);
  expect(transport.mock.calls.map(([url]) => requestUrl(url))).toEqual(
    expect.arrayContaining([
      expect.stringContaining("/api/public/search/climbs?"),
      expect.stringContaining("/api/public/search/areas?"),
    ]),
  );
  // Climb refinements belong to the Climbs tab; a mixed list has nothing to apply them to.
  expect(screen.queryByRole("button", { name: "Expand filters" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Climbers" }));
  expect(screen.getByText("Sign in to view climbers.")).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "Open Test route, Test area" }),
  ).not.toBeInTheDocument();
  expect(transport.mock.calls.some(([url]) => requestUrl(url).includes("/climbers"))).toBe(false);
});
it("discards a late member response after switching to public search", async () => {
  let resolve!: (response: Response) => void;
  const transport = vi.fn<typeof fetch>().mockImplementation(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  vi.stubGlobal("fetch", transport);
  const { rerender } = render(<Search key="member" publicOnly={false} />);
  await waitFor(() => expect(transport).toHaveBeenCalled());
  const finish = resolve;
  transport.mockImplementation(async () =>
    Response.json({ climbs: [], areas: [], areaBreadcrumbs: {}, hasNextPage: false }),
  );
  rerender(<Search key="anonymous" />);
  await act(async () =>
    finish(
      Response.json({
        climbers: [
          { id: "private", name: "Stale private name", image: null, friendshipStatus: "none" },
        ],
        hasMore: false,
      }),
    ),
  );
  expect(screen.queryByText("Stale private name")).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Member content" })).toBeVisible();
});

it("narrows signed-out climb results by discipline and grade, without member refinements", async () => {
  const transport = vi.fn<typeof fetch>(async (url) =>
    requestUrl(url).includes("/climbs?")
      ? Response.json({
          climbs: [
            {
              id: 1,
              name: "Test route",
              areaId: 2,
              areaName: "Test area",
              grade: 5,
              type: "boulder",
              description: "A route.",
            },
          ],
          areaBreadcrumbs: {},
          hasNextPage: false,
        })
      : Response.json({ areas: [], hasNextPage: false }),
  );
  vi.stubGlobal("fetch", transport);
  const climbRequests = () =>
    transport.mock.calls
      .map(([url]) => requestUrl(url))
      .filter((url) => url.includes("/api/public/search/climbs"));
  const user = userEvent.setup();
  render(<Search />);
  await user.click(screen.getByRole("button", { name: "Climbs" }));
  await user.click(await screen.findByRole("button", { name: "Expand filters" }));

  // Rating and ascent count are member aggregates: no fields, and no sort
  // field either — but the same sort control the member half uses.
  expect(screen.queryByRole("group", { name: "Rating range" })).not.toBeInTheDocument();
  expect(screen.queryByRole("spinbutton", { name: "Min ascents" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Sort by/ }));
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    "Name",
    "Grade",
  ]);
  await user.click(screen.getByRole("option", { name: "Grade" }));
  // Grade opens hardest-first, as it does for a member.
  await waitFor(() => expect(climbRequests().at(-1)).toContain("sort=grade_desc"));
  await user.click(screen.getByRole("button", { name: "Sort descending" }));
  await waitFor(() => expect(climbRequests().at(-1)).toContain("sort=grade_asc"));

  await user.click(screen.getByRole("button", { name: "Boulder", pressed: false }));
  await waitFor(() => expect(climbRequests().at(-1)).toContain("discipline=boulder"));
  expect(screen.getByRole("group", { name: "Boulder range" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Remove Boulder" })).toBeVisible();

  await user.click(screen.getByRole("button", { name: /Min grade/ }));
  await user.click(await screen.findByRole("option", { name: "V4" }));
  await waitFor(() => {
    const params = new URL(climbRequests().at(-1) ?? "", "https://betabook.test").searchParams;
    // V4 is index 5 on the Hueco scale; the untouched upper bound stays open.
    expect(params.getAll("boulderRange")).toEqual(["5", String(DEFAULT_BOULDER_RANGE[1])]);
  });

  // Clearing drops the refinements, and the next query goes out unnarrowed.
  await user.click(screen.getByRole("button", { name: "Clear all" }));
  expect(screen.queryByRole("region", { name: "Active filters" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Boulder" })).toHaveAttribute("aria-pressed", "false");
  await user.type(screen.getByRole("searchbox", { name: "Search Betabook" }), "Test");
  await waitFor(() => {
    const params = new URL(climbRequests().at(-1) ?? "", "https://betabook.test").searchParams;
    expect(params.get("name")).toBe("Test");
    expect(params.getAll("discipline")).toEqual([]);
    expect(params.getAll("boulderRange")).toEqual([]);
  });
  expect(transport.mock.calls.some(([url]) => requestUrl(url).includes("ratingRange"))).toBe(false);
});

it("carries the member ordering into the palette's sign-in link, which offers no sort", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async () =>
      Response.json({ climbs: [], areas: [], areaBreadcrumbs: {}, hasNextPage: false }),
    ),
  );
  const user = userEvent.setup();
  render(<Search quick />);
  const callout = screen.getByRole("region", { name: "Member content" });
  // The dialog shows neither filters nor a sort control, so the search it
  // hands back at sign-in keeps the member default rather than name order.
  expect(screen.queryByRole("button", { name: "Expand filters" })).not.toBeInTheDocument();
  const signIn = within(callout).getByRole("link", { name: "Sign in" });
  const href = (query: string) =>
    `/sign-in?next=${encodeURIComponent(searchHref({ ...EMPTY_SEARCH, query }))}`;
  expect(signIn).toHaveAttribute("href", href("Test"));

  await user.type(screen.getByRole("combobox", { name: "Search Betabook" }), "er");
  await waitFor(() => expect(signIn).toHaveAttribute("href", href("Tester")));
});
