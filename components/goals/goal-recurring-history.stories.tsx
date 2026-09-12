import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent, within } from "storybook/test";

import { goalPanelStoryArgs, goalHistorySample } from "@/stories/fixtures/goal-samples";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { GoalRecurringHistory } from "./goal-recurring-history";

const goal = goalHistorySample(3);
const meta = {
  title: "Components/Goals/Recurring history",
  component: GoalRecurringHistory,
  decorators: [
    (Story) => (
      <StoryPage title="Training history">
        <Story />
      </StoryPage>
    ),
  ],
  args: {
    ownerId: "story-goals",
    today: "2026-09-11",
    goal,
    currentPeriod: goalPanelStoryArgs.initialActive.goals.find((goal) => goal.id === 3),
    loadHistory: (offset: number, anchor?: string) =>
      goalPanelStoryArgs.loadHistory(3, offset, anchor),
  },
} satisfies Meta<typeof GoalRecurringHistory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Weekly: Story = {};

const monthlyGoal = goalPanelStoryArgs.initialActive.goals.find((goal) => goal.id === 4);
if (!monthlyGoal) throw new Error("Missing monthly goal fixture");
export const Monthly: Story = {
  args: {
    goal: goalHistorySample(4),
    currentPeriod: monthlyGoal,
    loadHistory: (offset, anchor) => goalPanelStoryArgs.loadHistory(4, offset, anchor),
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "See history" }));
  },
};
