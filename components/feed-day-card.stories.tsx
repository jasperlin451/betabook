import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { FeedDay } from "@/db/queries/feed";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { FeedDayCard } from "./feed-day-card";

const meta = { title: "Components/Journal/Feed day card", component: FeedDayCard } satisfies Meta<
  typeof FeedDayCard
>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
const day: FeedDay = {
  userId: "storybook-climber",
  name: "Alex Rivera",
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
      climbId: 1,
      climbName: "Cedar Arete",
      climbType: "boulder",
      climbGrade: 5,
      areaId: 1,
      areaName: "North Woods",
      ascentStyle: "flash",
      body: "Linked the moves with a high right foot.",
    },
    {
      id: 2,
      kind: "training",
      climbId: null,
      climbName: null,
      climbType: null,
      climbGrade: null,
      areaId: null,
      areaName: null,
      ascentStyle: null,
      body: "Easy movement practice and a short hangboard session.",
    },
  ],
};
export const ActivityFeed: Story = {
  render: () => (
    <StoryPage
      title="Activity feed"
      description="Feed cards share the panel radius, with a border and surface fill to group each day."
    >
      <FeedDayCard day={day} view="all" />
    </StoryPage>
  ),
};
export const SendOnlyFeed: Story = {
  render: () => (
    <StoryPage title="Send-only feed">
      <FeedDayCard
        day={{ ...day, journalVisible: false, training: 0, activities: day.activities.slice(0, 1) }}
        view="sends"
      />
    </StoryPage>
  ),
};
