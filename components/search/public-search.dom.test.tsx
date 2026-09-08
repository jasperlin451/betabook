import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { SearchController } from "@/components/search/search-controller";
import { EMPTY_SEARCH } from "@/lib/search";

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
function Search({ publicOnly = true }: { publicOnly?: boolean }) {
  const [state, setState] = useState({ ...EMPTY_SEARCH, query: "Test" });
  return (
    <SearchController
      publicOnly={publicOnly}
      state={state}
      onChange={setState}
      onNavigate={() => {}}
      onExpand={() => {}}
      resultHref={(item) => item.href}
    />
  );
}
it("queries only public name endpoints and keeps climber discovery locked", async () => {
  const transport = vi.fn<typeof fetch>(async (url) =>
    requestUrl(url).includes("/climbs?")
      ? Response.json({
          climbs: [{ id: 1, name: "Test route", areaId: 2, areaName: "Test area" }],
          areaBreadcrumbs: {},
          hasNextPage: false,
        })
      : Response.json({ areas: [], hasNextPage: false }),
  );
  vi.stubGlobal("fetch", transport);
  const user = userEvent.setup();
  render(<Search />);
  expect(await screen.findByRole("link", { name: "Open Test route, Test area" })).toBeVisible();
  expect(transport.mock.calls).toHaveLength(2);
  expect(transport.mock.calls.map(([url]) => requestUrl(url))).toEqual(
    expect.arrayContaining([
      expect.stringContaining("/api/public/search/climbs?"),
      expect.stringContaining("/api/public/search/areas?"),
    ]),
  );
  expect(screen.queryByRole("button", { name: "Boulder" })).not.toBeInTheDocument();
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
