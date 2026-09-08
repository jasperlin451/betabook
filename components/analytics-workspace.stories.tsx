import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatTileContent } from "@/components/analytics-stat-tiles";
import { Eyebrow } from "@/components/ui/eyebrow";
import { DEFAULT_ANALYTICS_LAYOUT } from "@/lib/analytics-layout";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { AnalyticsWorkspace } from "./analytics-workspace";
const meta = {
  title: "Components/Charts/Analytics workspace",
  component: AnalyticsWorkspace,
} satisfies Meta<typeof AnalyticsWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Customize: Story = {
  args: {
    canCustomize: true,
    cards: [
      {
        id: "sends",
        title: "Sends",
        content: <StatTileContent tile={{ label: "Sends", value: 24 }} />,
      },
      {
        id: "hardest",
        title: "Hardest",
        content: <StatTileContent tile={{ label: "Hardest", value: "V5", sub: "Cedar Arete" }} />,
      },
      {
        id: "streak",
        title: "Longest streak",
        content: <StatTileContent tile={{ label: "Longest streak", value: "3 days" }} />,
      },
    ],
    charts: [
      {
        id: "progression",
        title: "Progression",
        content: (
          <div>
            <Eyebrow>Progression</Eyebrow>
            <p className="text-sm text-muted">No dated sends with grades yet.</p>
          </div>
        ),
      },
      {
        id: "pyramid",
        title: "Grade pyramid",
        content: (
          <div>
            <Eyebrow>Grade pyramid</Eyebrow>
            <p className="text-sm text-muted">No graded sends yet.</p>
          </div>
        ),
      },
    ],
  },
  render: (args) => (
    <StoryPage
      title="Arrange your analytics"
      description="Customize to drag, reorder, hide, and restore items. Changes stay in this example."
    >
      <AnalyticsWorkspace {...args} />
    </StoryPage>
  ),
};

export const HiddenItems: Story = {
  ...Customize,
  args: {
    ...Customize.args,
    initialLayout: { ...DEFAULT_ANALYTICS_LAYOUT, hidden: ["sends", "pyramid"] },
  },
};
