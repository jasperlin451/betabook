import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

import type { FeedDay } from "@/db/queries/feed";
import { buildFeedCards } from "@/lib/feed-groups";

import { FeedGroupCard } from "./feed-group-card";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
it("shows the climb once and preserves both authors' statuses, notes, and authorized day destinations", () => {
  const activity: FeedDay["activities"][number] = {
    id: 1,
    kind: "session",
    climbId: 12,
    climbName: "Quiet Arete",
    climbType: "boulder",
    climbGrade: 5,
    areaId: 3,
    areaName: "Pine Canyon",
    ascentStyle: null,
    body: "Alex's sequence",
    companions: [{ id: "sam", name: "Sam", isSelf: false }],
  };
  const day: FeedDay = {
    userId: "alex",
    name: "Alex",
    image: null,
    date: "2026-09-02",
    journalVisible: true,
    sends: 0,
    repeats: 0,
    sessions: 1,
    training: 0,
    activities: [activity],
  };
  const cards = buildFeedCards(
    [
      day,
      {
        ...day,
        userId: "sam",
        name: "Sam",
        journalVisible: false,
        sends: 1,
        sessions: 0,
        activities: [
          {
            ...activity,
            id: 2,
            kind: "send",
            ascentStyle: "flash",
            body: null,
            companions: [],
          },
        ],
      },
    ],
    "all",
  );
  const group = cards[0];
  expect(group.kind).toBe("group");
  if (group.kind !== "group") throw Error("Expected explicitly connected group");
  const html = renderToStaticMarkup(<FeedGroupCard group={group} />);
  expect(html.match(/href="\/climbs\/12\/quiet-arete"/g)).toHaveLength(1);
  expect(html).toContain('href="/users/alex"');
  expect(html).toContain('href="/users/sam"');
  expect(html).toContain('href="/users/alex/journal?date=2026-09-02"');
  expect(html).toContain('href="/users/sam/sends?date=2026-09-02"');
  expect(html).not.toContain("/users/sam/journal");
  expect(html).toContain("Alex&#x27;s sequence");
  expect(html).toContain("Session");
  expect(html).not.toContain(">Sent<");
  expect(html).toContain("Flash");
});
