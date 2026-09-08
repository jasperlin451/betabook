import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import type { FeedDay } from "@/db/queries";
import type { FeedView } from "@/lib/feed";

import { FeedDayCard } from "./feed-day-card";

const activity: FeedDay["activities"][number] = {
  id: 1,
  kind: "send",
  climbId: 12,
  climbName: "Quiet Arete",
  climbType: "boulder",
  climbGrade: 5,
  areaId: 3,
  areaName: "Pine Canyon",
  ascentStyle: "flash",
  body: "Found the sequence.",
  companions: [{ id: "sam", name: "Sam Rivera", isSelf: false }],
};
const day: FeedDay = {
  userId: "alex",
  name: "Alex Rivera",
  image: null,
  date: "2026-09-01",
  journalVisible: true,
  sends: 3,
  repeats: 0,
  sessions: 0,
  training: 0,
  activities: [activity],
};
it.each<{ view: FeedView; visible: boolean; section: string }>([
  { view: "all", visible: true, section: "journal" },
  { view: "all", visible: false, section: "sends" },
  { view: "sends", visible: true, section: "sends" },
  { view: "sends", visible: false, section: "sends" },
])(
  "renders counts and correct day destinations for $view with journalVisible=$visible",
  ({ view, visible, section }) => {
    render(<FeedDayCard day={{ ...day, journalVisible: visible }} view={view} />);
    const card = screen.getByRole("article");
    expect(within(card).getByText("· 3 activities")).toBeInTheDocument();
    expect(within(card).getByText("Sep 1, 2026")).toHaveAttribute("datetime", "2026-09-01");
    expect(
      within(card).getByRole("link", { name: "View activity for Alex Rivera on Sep 1, 2026" }),
    ).toHaveAttribute("href", `/users/alex/${section}?date=2026-09-01`);
    expect(within(card).getByRole("link", { name: "See all activity (2 more)" })).toHaveAttribute(
      "href",
      `/users/alex/${section}?date=2026-09-01`,
    );
    expect(within(card).getByRole("link", { name: "Quiet Arete" })).toHaveAttribute(
      "href",
      "/climbs/12/quiet-arete",
    );
    expect(within(card).getByRole("link", { name: "Pine Canyon" })).toHaveAttribute(
      "href",
      "/areas/3/pine-canyon",
    );
    expect(within(card).getByText("Found the sequence.")).toBeInTheDocument();
    expect(within(card).getByText("Flash", { exact: true })).toBeInTheDocument();
    if (view === "sends") expect(screen.queryByText("Sam Rivera")).not.toBeInTheDocument();
    else
      expect(screen.getByRole("link", { name: "Sam Rivera" })).toHaveAttribute(
        "href",
        "/users/sam",
      );
  },
);
it("counts all unshown activity kinds and offers a destination even without previews", () => {
  const { rerender } = render(
    <FeedDayCard day={{ ...day, repeats: 1, sessions: 2, training: 1 }} view="all" />,
  );
  expect(screen.getByRole("link", { name: "See all activity (6 more)" })).toHaveAttribute(
    "href",
    "/users/alex/journal?date=2026-09-01",
  );
  rerender(<FeedDayCard day={{ ...day, sends: 0, training: 1, activities: [] }} view="all" />);
  expect(screen.getByText("· 1 activity")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "See all activity (1 more)" })).toHaveAttribute(
    "href",
    "/users/alex/journal?date=2026-09-01",
  );
  expect(screen.queryByRole("link", { name: "Quiet Arete" })).not.toBeInTheDocument();
});
it("omits the extra destination when all activity is previewed and renders outcomes once", () => {
  render(
    <FeedDayCard
      view="all"
      day={{
        ...day,
        sends: 1,
        repeats: 1,
        training: 1,
        activities: [
          { ...activity, ascentStyle: "redpoint" },
          {
            ...activity,
            id: 2,
            kind: "repeat",
            climbId: 13,
            climbName: "Pine Slab",
            ascentStyle: "redpoint",
          },
          {
            ...activity,
            id: 3,
            kind: "training",
            climbId: null,
            climbName: null,
            climbType: null,
            climbGrade: null,
            areaId: null,
            areaName: null,
            ascentStyle: null,
            body: "Hangboard session.",
            companions: [],
          },
        ],
      }}
    />,
  );
  expect(screen.queryByRole("link", { name: /See all activity/ })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Pine Slab" })).toHaveAttribute(
    "href",
    "/climbs/13/pine-slab",
  );
  for (const label of ["Redpoint", "Repeat", "Training"])
    expect(screen.getAllByText(label, { exact: true })).toHaveLength(1);
  expect(screen.getByText("Hangboard session.")).toBeInTheDocument();
  expect(screen.queryByText(/^(Sent|Repeated|Climbed on)$/)).not.toBeInTheDocument();
});
