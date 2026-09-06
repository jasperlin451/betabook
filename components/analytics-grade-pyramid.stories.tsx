import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Example, StoryPage } from "@/stories/fixtures/story-layout";

import { AnalyticsGradePyramid } from "./analytics-grade-pyramid";

const meta = {
  title: "Components/Charts/Grade pyramid",
  component: AnalyticsGradePyramid,
} satisfies Meta<typeof AnalyticsGradePyramid>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
export const GradePyramid: Story = {
  render: () => (
    <StoryPage title="Grade pyramids">
      {(["boulder", "sport", "trad"] as const).map((type) => (
        <Example key={type} title={type}>
          <AnalyticsGradePyramid
            type={type}
            rows={[
              { grade: 5, label: type === "boulder" ? "V4" : "5.10", count: 2 },
              { grade: 4, label: type === "boulder" ? "V3" : "5.9", count: 0 },
              { grade: 3, label: type === "boulder" ? "V2" : "5.8", count: 12 },
            ]}
          />
        </Example>
      ))}
    </StoryPage>
  ),
};
