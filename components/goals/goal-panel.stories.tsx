import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { summarizeGoalPeriods } from "@/lib/goal-history";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { GoalPanel } from "./goal-panel";
const meta = {
  title: "Components/Goals/Journal goals",
  component: GoalPanel,
  decorators: [
    (Story) => (
      <StoryPage title="Journal">
        <Story />
      </StoryPage>
    ),
  ],
  args: {
    ownerId: "story-goals",
    isOwner: true,
    timezone: "UTC",
    today: "2026-09-11",
    initialActive: { goals: [], hasMore: false },
    initialCompleted: { goals: [], hasMore: false },
  },
} satisfies Meta<typeof GoalPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SharedJournal: Story = {
  args: {
    isOwner: false,
    initialActive: {
      hasMore: false,
      goals: [
        {
          id: -1,
          userId: "story-goals",
          kind: "training",
          target: 8,
          discipline: null,
          grade: null,
          timeframe: "month",
          repeat: "none",
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          periodStart: "2026-09-01",
          periodEnd: "2026-09-30",
          timezone: "UTC",
          progress: 3,
          completedDate: null,
        },
      ],
    },
  },
};

export const CrossYearSeason: Story = {
  args: {
    initialActive: {
      hasMore: false,
      goals: [
        {
          id: -2,
          userId: "story-goals",
          kind: "volume",
          target: 8,
          discipline: "boulder",
          grade: 5,
          gradeMatch: "at-least",
          timeframe: "custom",
          repeat: "none",
          startDate: "2026-12-01",
          endDate: "2027-02-28",
          periodStart: "2026-12-01",
          periodEnd: "2027-02-28",
          timezone: "UTC",
          progress: 0,
          completedDate: null,
        },
      ],
    },
  },
};

const metMonthlyGoal = {
  id: -3,
  userId: "story-goals",
  kind: "training",
  target: 1,
  discipline: null,
  grade: null,
  timeframe: "month",
  repeat: "month",
  startDate: "2026-09-01",
  endDate: "2026-09-30",
  periodStart: "2026-09-01",
  periodEnd: "2026-09-30",
  timezone: "UTC",
  progress: 1,
  completedDate: "2026-09-02",
} as const;
export const MonthlyTargetMet: Story = {
  args: {
    initialActive: summarizeGoalPeriods(
      [metMonthlyGoal],
      "active",
      0,
      new Date("2026-09-11T12:00:00Z"),
    ),
    initialCompleted: summarizeGoalPeriods(
      [metMonthlyGoal],
      "completed",
      0,
      new Date("2026-09-11T12:00:00Z"),
    ),
  },
};

const weeklyPeriods = [7, 14, 21, 28].map((day, index) => ({
  ...metMonthlyGoal,
  id: -4,
  repeat: "week" as const,
  timeframe: "week" as const,
  target: 3,
  startDate: "2026-09-07",
  endDate: "2026-09-13",
  periodStart: `2026-09-${String(day).padStart(2, "0")}`,
  periodEnd: index === 3 ? "2026-10-04" : `2026-09-${day + 6}`,
  progress: index === 2 ? 1 : 3,
  completedDate: index === 2 ? null : `2026-09-${String(day + 1).padStart(2, "0")}`,
}));
const weeklyConsistency = [
  ...weeklyPeriods,
  {
    ...weeklyPeriods[0],
    periodStart: "2026-10-05",
    periodEnd: "2026-10-11",
    progress: 1,
    completedDate: null,
  },
];
export const WeeklyConsistency: Story = {
  args: {
    today: "2026-10-06",
    initialActive: summarizeGoalPeriods(
      weeklyConsistency,
      "active",
      0,
      new Date("2026-10-06T12:00:00Z"),
    ),
    initialCompleted: summarizeGoalPeriods(
      weeklyConsistency,
      "completed",
      0,
      new Date("2026-10-06T12:00:00Z"),
    ),
  },
};
