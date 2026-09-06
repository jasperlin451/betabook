import { Input, Label, TextField } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { DEFAULT_DISCIPLINE_FILTER } from "@/lib/discipline-filter";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { FilterToolbar } from "./filter-toolbar";

const meta = { title: "Components/Inputs/Filter toolbar", component: FilterToolbar } satisfies Meta<
  typeof FilterToolbar
>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
function FiltersExample() {
  const [filter, setFilter] = useState(DEFAULT_DISCIPLINE_FILTER);
  return (
    <StoryPage title="Climb filter toolbar">
      <FilterToolbar
        value={filter}
        onChange={setFilter}
        onReset={() => setFilter(DEFAULT_DISCIPLINE_FILTER)}
        search={
          <TextField>
            <Label>Climb name</Label>
            <Input placeholder="Search sample climbs" />
          </TextField>
        }
      />
    </StoryPage>
  );
}
export const Filters: Story = { render: () => <FiltersExample /> };
