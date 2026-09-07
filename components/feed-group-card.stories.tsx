import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { FeedDay } from "@/db/queries/feed";
import type { FeedCard } from "@/lib/feed-groups";
import { feedStoryClimbs } from "@/stories/fixtures/feed-climbs";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { FeedGroupCard } from "./feed-group-card";

const meta = {
  title: "Components/Journal/Feed group card",
  component: FeedGroupCard,
} satisfies Meta<typeof FeedGroupCard>;
export default meta;
type Story = StoryObj;
const base: FeedDay = {
  userId: "alex",
  name: "Alex Rivera",
  image: null,
  date: "2026-09-02",
  journalVisible: true,
  sends: 0,
  repeats: 0,
  sessions: 1,
  training: 0,
  activities: [],
};
const activity: FeedDay["activities"][number] = {
  id: 1,
  kind: "session",
  ...feedStoryClimbs[0],
  ascentStyle: null,
  body: "Worked the opening moves with Jordan.",
  companions: [{ id: "jordan", name: "Jordan Lee", isSelf: false }],
};
const group: Extract<FeedCard, { kind: "group" }> = {
  kind: "group",
  key: "sample",
  date: base.date,
  entryKind: "climb",
  entries: [
    {
      day: { ...base, sends: 1, sessions: 0 },
      activity: { ...activity, kind: "send", ascentStyle: "redpoint" },
    },
    {
      day: { ...base, userId: "jordan", name: "Jordan Lee" },
      activity: {
        ...activity,
        id: 2,
        body: "Found a comfortable high foot.",
        companions: [{ id: "alex", name: "Alex Rivera", isSelf: false }],
      },
    },
  ],
};
export const SharedClimb: Story = {
  render: () => (
    <StoryPage
      title="Shared climb in the feed"
      description="Both friends tagged each other. Alex redpointed; Jordan logged a session."
    >
      <FeedGroupCard group={group} />
    </StoryPage>
  ),
};
export const ConnectedTraining: Story = {
  render: () => (
    <StoryPage title="Training updates">
      <FeedGroupCard
        group={{
          ...group,
          entryKind: "training",
          entries: group.entries.map((e) => ({
            ...e,
            day: { ...e.day, sends: 0, sessions: 0, training: 1 },
            activity: {
              ...e.activity,
              kind: "training",
              climbId: null,
              climbName: null,
              climbType: null,
              climbGrade: null,
              areaId: null,
              areaName: null,
              areaAncestors: [],
              ascentStyle: null,
              body: `${e.day.name}'s mobility and strength work.`,
            },
          })),
        }}
      />
    </StoryPage>
  ),
};
export const LargeGroup: Story = {
  render: () => (
    <StoryPage
      title="A busy session"
      description="Hover or focus 7 others to see the remaining authors."
    >
      <FeedGroupCard
        group={{
          ...group,
          entries: Array.from({ length: 8 }, (_, index) => ({
            day: {
              ...base,
              userId: `friend-${index}`,
              name: `Climbing friend ${index + 1} with a long name`,
              sends: Number(index % 3 === 0),
              repeats: Number(index % 3 === 1),
              sessions: Number(index % 3 === 2),
            },
            activity: {
              ...activity,
              id: index + 1,
              kind: index % 3 === 0 ? "send" : index % 3 === 1 ? "repeat" : "session",
              ascentStyle: index % 3 === 0 ? "flash" : null,
              body: `Notes from climber ${index + 1}.`,
              companions:
                index < 7
                  ? [
                      {
                        id: `friend-${index + 1}`,
                        name: `Climbing friend ${index + 2} with a long name`,
                        isSelf: false,
                      },
                    ]
                  : [],
            },
          })),
        }}
      />
    </StoryPage>
  ),
};
