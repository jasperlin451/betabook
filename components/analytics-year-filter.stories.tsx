import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { formatAnalyticsYears } from "@/lib/analytics-years";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { AnalyticsYearFilter } from "./analytics-year-filter";

const meta = {
  title: "Components/Inputs/Analytics years",
  component: AnalyticsYearFilter,
} satisfies Meta<typeof AnalyticsYearFilter>;
export default meta;
type Story = StoryObj;
function YearExample() {
  const [selected, setSelected] = useState<number[]>([2020, 2021, 2022, 2023]);
  return (
    <StoryPage
      title="Analytics years"
      description="Choose any combination of years. All resets the selection."
    >
      <AnalyticsYearFilter
        years={Array.from({ length: 10 }, (_, index) => 2017 + index)}
        selected={selected}
        onChange={setSelected}
      />
      <p role="status" className="text-sm text-muted">
        {formatAnalyticsYears(selected)}
      </p>
    </StoryPage>
  );
}
export const Selection: Story = { render: () => <YearExample /> };
