import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

import { DEFAULT_ANALYTICS_LAYOUT, DEFAULT_CARDS } from "@/lib/analytics-layout";

import { AnalyticsWorkspace } from "./analytics-workspace";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: true,
    media,
    addEventListener: vi.fn<() => void>(),
    removeEventListener: vi.fn<() => void>(),
    addListener: vi.fn<() => void>(),
    removeListener: vi.fn<() => void>(),
  }));
});

const cards = DEFAULT_CARDS.map((id) => ({
  id,
  title: id,
  description: id === "streak" ? "Your longest run of consecutive climbing days." : undefined,
  content: <span>{id} value</span>,
}));

it("starts with five cards and lets an owner discover, add, and save another", async () => {
  const user = userEvent.setup();
  const onSave = vi
    .fn<() => Promise<{ ok: true; value: undefined }>>()
    .mockResolvedValue({ ok: true, value: undefined });
  render(<AnalyticsWorkspace cards={cards} charts={[]} canCustomize onSave={onSave} />);
  expect(screen.getAllByRole("article").map((el) => el.getAttribute("aria-label"))).toEqual([
    "sends",
    "hardest",
    "days",
    "firstTry",
    "bestYear",
  ]);
  await user.click(screen.getByRole("button", { name: "Customize cards" }));
  expect(screen.getByRole("heading", { name: "Customize your analytics layout" })).toBeVisible();
  expect(
    screen.getByText(
      "Drag to reorder or use X to hide items in your view without changing your stats or who can see them.",
    ),
  ).toBeVisible();
  expect(
    within(screen.getByRole("group", { name: "Dashboard actions" })).getByRole("button", {
      name: "Save layout",
    }),
  ).toBeVisible();
  const choices = screen.getByRole("group", { name: "At a glance" });
  expect(within(choices).getByText("Your longest run of consecutive climbing days.")).toBeVisible();
  await user.click(within(choices).getByRole("button", { name: "Add streak" }));
  expect(screen.getByRole("article", { name: "streak" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Save layout" }));
  expect(onSave).toHaveBeenCalledWith({
    ...DEFAULT_ANALYTICS_LAYOUT,
    hidden: DEFAULT_ANALYTICS_LAYOUT.hidden.filter((id) => id !== "streak"),
  });
});

it("preserves an existing saved layout and hides discovery controls from visitors", () => {
  const initialLayout = {
    ...DEFAULT_ANALYTICS_LAYOUT,
    cards: DEFAULT_CARDS.slice(0, 10),
    hidden: [],
  };
  const { rerender } = render(
    <AnalyticsWorkspace cards={cards} charts={[]} canCustomize initialLayout={initialLayout} />,
  );
  expect(screen.getAllByRole("article")).toHaveLength(10);
  rerender(<AnalyticsWorkspace cards={cards} charts={[]} initialLayout={initialLayout} />);
  expect(screen.queryByRole("button", { name: "Customize cards" })).not.toBeInTheDocument();
});

it("opens the same editor from hidden chart and card placeholders, including empty sections", async () => {
  const user = userEvent.setup();
  const charts = [
    { id: "pyramid" as const, title: "Pyramid", content: <span>Pyramid chart</span> },
  ];
  render(
    <AnalyticsWorkspace
      cards={cards}
      charts={charts}
      canCustomize
      initialLayout={{ ...DEFAULT_ANALYTICS_LAYOUT, hidden: [...DEFAULT_CARDS, "pyramid"] }}
    />,
  );
  expect(screen.queryByRole("button", { name: "Add cards" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Customize cards" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Customize charts" }));
  expect(screen.getByRole("group", { name: "Charts" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Customize charts" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await user.click(screen.getByRole("button", { name: "Customize cards" }));
  expect(screen.getByRole("group", { name: "At a glance" })).toBeVisible();
});

it("has no placeholders when every item is displayed", () => {
  render(
    <AnalyticsWorkspace
      cards={cards}
      charts={[]}
      canCustomize
      initialLayout={{ ...DEFAULT_ANALYTICS_LAYOUT, hidden: [] }}
    />,
  );
  expect(screen.getByRole("button", { name: "Customize dashboard" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Customize cards" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Customize charts" })).not.toBeInTheDocument();
});
