import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { ClimbFilterControls } from "@/components/filters/climb-filter-controls";
import { DEFAULT_CLIMB_FILTER } from "@/lib/filters/climb-filter";
import type { ClimbFilterState } from "@/lib/filters/climb-filter-state";
import { StoryPage } from "@/stories/fixtures/story-layout";
const meta = {
  title: "Components/Filters/Climb controls",
  component: ClimbFilterControls,
} satisfies Meta<typeof ClimbFilterControls>;
export default meta;
type Story = StoryObj;
function Example({ legacy = false }: { legacy?: boolean }) {
  const [state, setState] = useState<ClimbFilterState>({
    sort: "name_asc",
    area: null,
    filter: { ...DEFAULT_CLIMB_FILTER, areaName: legacy ? "Cedar" : undefined },
  });
  return (
    <StoryPage title="Climb filters">
      <ClimbFilterControls value={state} onChange={(next) => setState({ ...state, ...next })} />
    </StoryPage>
  );
}
export const Filters: Story = { render: () => <Example /> };
export const LegacyAreaName: Story = { render: () => <Example legacy /> };
