import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { AnalyticsYearSelect } from "./analytics-year-select";

const meta = {
  title: "Components/Filters/Analytics year",
  component: AnalyticsYearSelect,
  args: {
    param: "pyramid",
    years: [2026, 2025, 2024],
    selected: null,
    allLabel: "All time",
    label: "Pyramid year",
  },
  decorators: [
    (Story) => (
      <StoryPage
        title="Analytics year filter"
        description="Year filters use the shared medium field width."
      >
        <Story />
      </StoryPage>
    ),
  ],
} satisfies Meta<typeof AnalyticsYearSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AllTime: Story = {};
export const SelectedYear: Story = { args: { selected: 2025 } };
