import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { userEvent } from "storybook/test";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { ChartInspection } from "./chart-inspection";

const meta = {
  title: "Components/Charts/Chart inspection",
  component: ChartInspection,
  decorators: [
    (Story) => (
      <StoryPage title="Chart inspection">
        <Story />
      </StoryPage>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Content-sized floating tooltips inside the chart for pointer, touch, and keyboard exploration. No permanent instruction or readout appears below the plot. Focus the plot and use arrow keys, Home, or End to inspect values; Escape clears the readout.",
      },
    },
  },
} satisfies Meta<typeof ChartInspection>;
export default meta;
type Story = StoryObj<typeof meta>;
export const DataPoints: Story = {
  args: {
    label: "Monthly sends",
    children: (
      <svg viewBox="0 0 320 120" className="w-full max-w-md" aria-hidden>
        <path d="M 30 90 L 150 40 L 290 60" fill="none" className="stroke-accent" strokeWidth={3} />
        {[90, 40, 60].map((y, i) => (
          <circle
            key={y}
            cx={[30, 150, 290][i]}
            cy={y}
            r={12}
            className="fill-accent"
            data-chart-detail={`${["January", "February", "March"][i]}: ${[3, 8, 6][i]} sends`}
          />
        ))}
      </svg>
    ),
  },
};

export const TooltipVisible: Story = {
  ...DataPoints,
  play: async ({ canvasElement }) => {
    const point = canvasElement.querySelector("[data-chart-detail]");
    if (!point) throw new Error("Expected a chart data point");
    await userEvent.hover(point);
  },
};
