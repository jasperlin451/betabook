import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import type { FeedDay } from "@/db/queries";
import type { FeedView } from "@/lib/feed";

import { FeedDayCard } from "./feed-day-card";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({ default: () => null }));
const day: FeedDay = {
  userId: "climber",
  name: "Alex",
  image: null,
  date: "2026-09-01",
  journalVisible: true,
  sends: 1,
  repeats: 0,
  sessions: 0,
  training: 1,
  activities: [
    {
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
    },
  ],
};

it("links activity and day details to the correct entities and filter", () => {
  const html = renderToStaticMarkup(<FeedDayCard day={day} view="all" />);
  expect(html).toContain('href="/climbs/12/quiet-arete"');
  expect(html).toContain('href="/areas/3/pine-canyon"');
  expect(html).toContain('href="/users/climber/journal?date=2026-09-01"');
  expect(html).toContain("2 activities");
  expect(html).toContain("Found the sequence.");
  expect(html).toContain("Flash");
  for (const [journalVisible, view] of [
    [false, "all"],
    [true, "sends"],
  ] as const) {
    const sends = renderToStaticMarkup(
      <FeedDayCard day={{ ...day, journalVisible }} view={view} />,
    );
    expect(sends).toContain('href="/users/climber/sends?date=2026-09-01"');
    expect(sends).not.toContain("/journal?");
  }
});

const busyDay: FeedDay = {
  userId: "alex",
  name: "Alex Rivera",
  image: null,
  date: "2026-09-01",
  journalVisible: true,
  sends: 5,
  repeats: 0,
  sessions: 0,
  training: 0,
  activities: ["Cedar Arete", "Pine Slab", "Birch Wall"].map((climbName, index) => ({
    id: index + 1,
    kind: "send",
    climbId: index + 1,
    climbName,
    climbType: "boulder",
    climbGrade: 5,
    areaId: 1,
    areaName: "North Woods",
    ascentStyle: "flash",
    body: null,
  })),
};

it.each<{ view: FeedView; journalVisible: boolean; section: string }>([
  { view: "all", journalVisible: true, section: "journal" },
  { view: "all", journalVisible: false, section: "sends" },
  { view: "sends", journalVisible: true, section: "sends" },
])(
  "links the two unshown sends to the authorized day in $view/$section",
  ({ view, journalVisible, section }) => {
    const html = renderToStaticMarkup(
      <FeedDayCard day={{ ...busyDay, journalVisible }} view={view} />,
    );
    expect(html).toContain("5 activities");
    for (const name of ["Cedar Arete", "Pine Slab", "Birch Wall"]) expect(html).toContain(name);
    expect(html).toMatch(
      new RegExp(
        `<a[^>]*href="/users/alex/${section}\\?date=2026-09-01"[^>]*>See all activity \\(2 more\\)</a>`,
      ),
    );
  },
);

it("counts unshown sessions, repeats, and training alongside sends", () => {
  const html = renderToStaticMarkup(
    <FeedDayCard day={{ ...busyDay, sends: 3, repeats: 1, sessions: 2, training: 1 }} view="all" />,
  );
  expect(html).toContain("See all activity (4 more)");
});

it("offers the day destination when grouping has moved every loaded preview", () => {
  const html = renderToStaticMarkup(
    <FeedDayCard day={{ ...busyDay, sends: 0, training: 1, activities: [] }} view="all" />,
  );
  expect(html).toContain("1 activity");
  expect(html).toMatch(
    /<a[^>]*href="\/users\/alex\/journal\?date=2026-09-01"[^>]*>See all activity \(1 more\)<\/a>/,
  );
});

it("omits the extra link when every activity is already previewed", () => {
  const html = renderToStaticMarkup(<FeedDayCard day={{ ...busyDay, sends: 3 }} view="all" />);
  expect(html).toContain("3 activities");
  expect(html).not.toContain("See all activity");
});

it("shows each outcome once without repeating send or training labels", () => {
  const html = renderToStaticMarkup(
    <FeedDayCard
      day={{
        ...busyDay,
        sends: 1,
        repeats: 1,
        training: 1,
        activities: [
          { ...busyDay.activities[0], ascentStyle: "redpoint" },
          { ...busyDay.activities[1], kind: "repeat", ascentStyle: "redpoint" },
          {
            ...busyDay.activities[2],
            kind: "training",
            climbId: null,
            climbName: null,
            climbType: null,
            areaId: null,
            areaName: null,
            ascentStyle: null,
          },
        ],
      }}
      view="all"
    />,
  );
  expect(html.match(/>Redpoint</g)).toHaveLength(1);
  expect(html.match(/>Repeat</g)).toHaveLength(1);
  expect(html.match(/>Training</g)).toHaveLength(1);
  expect(html).not.toMatch(/>Sent[< ·]|>Repeated[< ·]|Climbed on/);
});
