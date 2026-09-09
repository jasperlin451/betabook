import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { TERMS_REQUIRED_EVENT } from "@/lib/terms";

import { TermsGate } from "./terms-gate";

const location = vi.hoisted(() => ({ path: "/friends" }));
vi.mock("next/navigation", () => ({ usePathname: () => location.path }));
beforeEach(() => {
  location.path = "/friends";
  window.history.replaceState({}, "", "/friends?view=requests");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("does not render member children when server acceptance is missing", async () => {
  const onRedirect = vi.fn<(url: string) => void>();
  render(
    <TermsGate viewerId="u" initiallyRequired onRedirect={onRedirect}>
      <p>Member data</p>
    </TermsGate>,
  );
  expect(screen.queryByText("Member data")).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Review the Terms of Service" })).toBeVisible();
  expect(onRedirect).toHaveBeenCalledWith("/accept-terms?next=%2Ffriends%3Fview%3Drequests");
});

it("detects a revised agreement during an already-open session on the next active check", async () => {
  const now = vi.spyOn(Date, "now").mockReturnValue(0);
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ userId: "u", required: false }))
    .mockResolvedValueOnce(Response.json({ userId: "u", required: true }));
  vi.stubGlobal("fetch", transport);
  const onRedirect = vi.fn<(url: string) => void>();
  const user = userEvent.setup();
  render(
    <TermsGate viewerId="u" initiallyRequired={false} onRedirect={onRedirect}>
      <button type="button">Member action</button>
    </TermsGate>,
  );
  await waitFor(() => expect(transport).toHaveBeenCalledTimes(1));
  now.mockReturnValue(61_000);
  await user.click(screen.getByRole("button", { name: "Member action" }));
  await waitFor(() => expect(onRedirect).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole("button", { name: "Member action" })).not.toBeInTheDocument();
  expect(transport).toHaveBeenLastCalledWith(
    "/api/terms/status",
    expect.objectContaining({ cache: "no-store" }),
  );
});

it("reacts immediately to a denied data request", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockResolvedValue(Response.json({ userId: "u", required: false })),
  );
  const onRedirect = vi.fn<(url: string) => void>();
  render(
    <TermsGate viewerId="u" initiallyRequired={false} onRedirect={onRedirect}>
      <p>Member data</p>
    </TermsGate>,
  );
  // apiFetch emits this transport event; it is not a user input event.
  fireEvent(window, new Event(TERMS_REQUIRED_EVENT));
  expect(onRedirect).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Member data")).not.toBeInTheDocument();
});

it.each(["/terms", "/terms/2026-09-09", "/contact", "/accept-terms"])(
  "does not trap people away from %s",
  (path) => {
    location.path = path;
    const transport = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", transport);
    const onRedirect = vi.fn<(url: string) => void>();
    render(
      <TermsGate viewerId="u" initiallyRequired onRedirect={onRedirect}>
        <p>Readable content</p>
      </TermsGate>,
    );
    expect(screen.getByText("Readable content")).toBeVisible();
    expect(onRedirect).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  },
);

it("ignores an old viewer's response after the component is replaced", async () => {
  let resolve!: (response: Response) => void;
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue(Response.json({ userId: "new", required: false })),
  );
  const onRedirect = vi.fn<(url: string) => void>();
  const view = render(
    <TermsGate viewerId="old" initiallyRequired={false} onRedirect={onRedirect}>
      <p>Old member</p>
    </TermsGate>,
  );
  view.rerender(
    <TermsGate viewerId="new" initiallyRequired={false} onRedirect={onRedirect}>
      <p>New member</p>
    </TermsGate>,
  );
  await act(async () => resolve(Response.json({ userId: "old", required: true })));
  expect(onRedirect).not.toHaveBeenCalled();
  expect(screen.getByText("New member")).toBeVisible();
});
