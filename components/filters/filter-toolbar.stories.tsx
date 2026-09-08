import { Input, Label, TextField } from "@heroui/react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { HashtagFilter } from "@/components/filters/hashtag-filter";
import { DEFAULT_DISCIPLINE_FILTER } from "@/lib/filters/discipline-filter";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { FilterToolbar } from "./filter-toolbar";

const meta = { title: "Components/Filters/Toolbar", component: FilterToolbar } satisfies Meta<
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
        textFilter={
          <TextField>
            <Label>Climb name</Label>
            <Input placeholder="Filter sample climbs" />
          </TextField>
        }
      />
    </StoryPage>
  );
}
export const Filters: Story = { render: () => <FiltersExample /> };

function HashtagFiltersExample() {
  const [filter, setFilter] = useState(DEFAULT_DISCIPLINE_FILTER);
  const [tags, setTags] = useState<string[]>([]);
  return (
    <StoryPage
      title="Hashtag toolbar"
      description="Selected hashtags expand below the filter fields."
    >
      <FilterToolbar
        value={filter}
        onChange={setFilter}
        onReset={() => {
          setFilter(DEFAULT_DISCIPLINE_FILTER);
          setTags([]);
        }}
        textFilter={
          <>
            <TextField aria-label="Filter climbs" className="w-full sm:w-64">
              <Input placeholder="Filter climbs…" />
            </TextField>
          </>
        }
        extraFilters={
          <HashtagFilter
            inlineLabel
            value={tags}
            onChange={setTags}
            tags={["power", "strength", "trip"]}
          />
        }
      />
    </StoryPage>
  );
}
export const Hashtags: Story = { render: () => <HashtagFiltersExample /> };
