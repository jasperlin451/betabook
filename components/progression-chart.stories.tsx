import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Example, StoryPage } from "@/stories/fixtures/story-layout";

import { ProgressionChart } from "./progression-chart";

const meta = {
  title: "Components/Charts/Progression chart",
  component: ProgressionChart,
} satisfies Meta<typeof ProgressionChart>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
export const Progression: Story = {
  render: () => (
    <StoryPage title="Personal-best progression">
      <ProgressionChart
        type="boulder"
        points={[
          { month: "2025-09", hardest: 3, best: 3 },
          { month: "2026-01", hardest: 5, best: 5 },
          { month: "2026-06", hardest: 4, best: 5 },
          { month: "2026-09", hardest: 7, best: 7 },
        ]}
      />
      <Example title="Single active month">
        <ProgressionChart type="sport" points={[{ month: "2026-09", hardest: 12, best: 12 }]} />
      </Example>
    </StoryPage>
  ),
};
