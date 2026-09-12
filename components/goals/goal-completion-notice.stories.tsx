import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { goalPanelStoryArgs } from "@/stories/fixtures/goal-samples";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { GoalCompletionNotice } from "./goal-completion-notice";

const meta = {
  title: "Components/Goals/Completion celebration",
  component: GoalCompletionNotice,
  decorators: [
    (Story) => (
      <StoryPage title="Goal achieved">
        <Story />
      </StoryPage>
    ),
  ],
  args: {
    goal: goalPanelStoryArgs.initialCompleted.goals[0],
    onView: () => {},
    rememberDismissal: false,
  },
  parameters: {
    docs: {
      description: {
        component:
          "Three treatments for the same production completion notice. Banner is the default: a strong green surface, a 24px display headline, and a readable 16px achievement. Compact uses an 18px heading; Milestone uses 30px and a centered layout.",
      },
    },
  },
} satisfies Meta<typeof GoalCompletionNotice>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BoldBanner: Story = {};
export const CompactHighlight: Story = { args: { appearance: "compact" } };
export const MilestoneCard: Story = { args: { appearance: "milestone" } };
