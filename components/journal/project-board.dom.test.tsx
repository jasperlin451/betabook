import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { createJournalEntry, createUndatedSend, updateJournalEntry } from "@/actions";
import type { JournalEntry } from "@/db/queries";

import { ProjectBoard } from "./project-board";
import type { ProjectWithSessions } from "./project-card";

vi.mock("@/actions", () => ({
  createJournalEntry: vi.fn<typeof createJournalEntry>(),
  createUndatedSend: vi.fn<typeof createUndatedSend>(),
  updateJournalEntry: vi.fn<typeof updateJournalEntry>(),
}));

function session(overrides: Partial<JournalEntry> & { id: number }): JournalEntry {
  return {
    climbId: 1,
    kind: "session",
    sent: false,
    entryDate: "2026-09-01",
    body: null,
    tags: [],
    companions: [],
    climbName: "Sample",
    climbType: "boulder",
    climbGrade: 5,
    areaId: 3,
    areaName: "Sample Block",
    isAscent: false,
    isSendComment: false,
    ...overrides,
  };
}

const slab: ProjectWithSessions = {
  climbId: 1,
  climbName: "Moon Slab",
  climbType: "boulder",
  climbGrade: 5,
  areaId: 3,
  areaName: "Cedar Block",
  sessionCount: 3,
  noteCount: 2,
  firstSession: "2026-05-02",
  lastSession: "2026-09-01",
  sessions: [
    session({
      id: 11,
      entryDate: "2026-09-01",
      body: "Heel slipping off the arete.",
      tags: ["beta"],
    }),
    session({ id: 10, entryDate: "2026-08-02", body: "Linked the bottom half." }),
  ],
};

const crack: ProjectWithSessions = {
  climbId: 2,
  climbName: "Ash Crack",
  climbType: "trad",
  climbGrade: 6,
  areaId: 4,
  areaName: "Granite Wall",
  sessionCount: 9,
  noteCount: 1,
  firstSession: "2026-01-04",
  lastSession: "2026-07-15",
  sessions: [session({ id: 21, climbId: 2, entryDate: "2026-07-15", body: "Ran out of cams." })],
};

const projects = [slab, crack];

function card(climbName: string): HTMLElement {
  const heading = screen.getByRole("heading", { name: climbName, level: 3 });
  const article = heading.closest("article");
  if (article == null) throw new Error(`No card rendered for ${climbName}`);
  return article;
}

function headings(): (string | null)[] {
  return screen.queryAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
}

/** The preview and the collapsed panel both hold the newest note, so a
 * lookup by its text has to say which copy it means — the panel is the one
 * behind the `hidden` attribute. */
function visibleText(container: HTMLElement, text: string): HTMLElement[] {
  return within(container)
    .getAllByText(text)
    .filter((element) => element.closest("[hidden]") == null);
}

it("shows each project's latest note without opening anything", () => {
  render(<ProjectBoard userId="climber" projects={projects} hasMore={false} />);

  expect(visibleText(card("Moon Slab"), "Heel slipping off the arete.")).toHaveLength(1);
  expect(visibleText(card("Ash Crack"), "Ran out of cams.")).toHaveLength(1);
  // The older note is only in the collapsed panel until the card is opened.
  expect(screen.getByText("Linked the bottom half.")).not.toBeVisible();
});

it("opens a project's session history in place and puts it away again", async () => {
  const user = userEvent.setup();
  render(<ProjectBoard userId="climber" projects={projects} hasMore={false} />);
  const slabCard = card("Moon Slab");
  const toggle = within(slabCard).getByRole("button", { name: /Read 2 notes/ });

  await user.click(toggle);

  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(within(slabCard).getByText("Linked the bottom half.")).toBeVisible();
  // The preview would repeat the newest note the panel now shows in full.
  expect(within(slabCard).queryByText("Latest note")).not.toBeInTheDocument();
  // Opening one project leaves the others alone.
  expect(within(card("Ash Crack")).getByRole("button", { name: /Read 1 note/ })).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  await user.click(within(slabCard).getByRole("button", { name: "Hide sessions" }));

  expect(within(slabCard).getByText("Linked the bottom half.")).not.toBeVisible();
  expect(within(slabCard).getByText("Latest note")).toBeVisible();
});

it("expands and collapses every project at once", async () => {
  const user = userEvent.setup();
  render(<ProjectBoard userId="climber" projects={projects} hasMore={false} />);

  await user.click(screen.getByRole("button", { name: "Expand all" }));

  expect(screen.getAllByRole("button", { name: "Hide sessions" })).toHaveLength(2);

  await user.click(screen.getByRole("button", { name: "Collapse all" }));

  expect(screen.queryByRole("button", { name: "Hide sessions" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Read 2 notes/ })).toBeInTheDocument();
});

it.each([
  ["a climb name", "moon"],
  ["an area", "granite"],
  ["a tag written on a session", "beta"],
  ["the text of a note", "cams"],
])("filters the list by %s", async (_label, needle) => {
  const user = userEvent.setup();
  render(<ProjectBoard userId="climber" projects={projects} hasMore={false} />);

  await user.type(screen.getByRole("searchbox", { name: "Filter projects" }), needle);

  const expected = needle === "moon" || needle === "beta" ? ["Moon Slab"] : ["Ash Crack"];
  expect(headings()).toEqual(expected);
});

it("says so when nothing matches, and restores the list when the search is cleared", async () => {
  const user = userEvent.setup();
  render(<ProjectBoard userId="climber" projects={projects} hasMore={false} />);
  const search = screen.getByRole("searchbox", { name: "Filter projects" });

  await user.type(search, "kneebar");

  expect(headings()).toEqual([]);
  expect(screen.getByText("No open projects match this search.")).toBeInTheDocument();

  await user.clear(search);

  expect(headings()).toEqual(["Moon Slab", "Ash Crack"]);
});

it("reorders the list without dropping a project", async () => {
  const user = userEvent.setup();
  render(<ProjectBoard userId="climber" projects={projects} hasMore={false} />);

  expect(headings()).toEqual(["Moon Slab", "Ash Crack"]);

  await user.click(screen.getByRole("button", { name: /Sort projects/ }));
  await user.click(await screen.findByRole("option", { name: "Most sessions" }));

  expect(headings()).toEqual(["Ash Crack", "Moon Slab"]);

  await user.click(screen.getByRole("button", { name: /Sort projects/ }));
  await user.click(await screen.findByRole("option", { name: "Name" }));

  expect(headings()).toEqual(["Ash Crack", "Moon Slab"]);

  await user.click(screen.getByRole("button", { name: /Sort projects/ }));
  await user.click(await screen.findByRole("option", { name: "Longest running" }));

  expect(headings()).toEqual(["Ash Crack", "Moon Slab"]);
});

it("logs a session against the project whose button was pressed", async () => {
  const user = userEvent.setup();
  render(<ProjectBoard userId="climber" projects={projects} hasMore={false} />);

  await user.click(screen.getByRole("button", { name: "Log a session on Ash Crack" }));

  const drawer = await screen.findByRole("dialog");
  expect(within(drawer).getByRole("heading", { name: "Log entry" })).toBeInTheDocument();
  expect(within(drawer).getByText("Logging an outdoor session on Ash Crack.")).toBeInTheDocument();

  vi.mocked(createJournalEntry).mockResolvedValue({ ok: true, value: undefined });
  await user.click(within(drawer).getByRole("button", { name: "Save entry" }));

  await waitFor(() => expect(createJournalEntry).toHaveBeenCalledTimes(1));
  expect(vi.mocked(createJournalEntry).mock.calls[0][0].get("climbId")).toBe("2");
});

it("invites a first session when there are no open projects", () => {
  render(<ProjectBoard userId="climber" projects={[]} hasMore={false} />);

  expect(
    screen.getByText(/No open projects\. Log a session on a climb you haven't sent/),
  ).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
});
