import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { HashtagFilter } from "./hashtag-filter";
const meta = { title: "Components/Inputs/Hashtag filter", component: HashtagFilter } satisfies Meta<
  typeof HashtagFilter
>;
export default meta;
function Example({ initialValue }: { initialValue: string[] }) {
  const [value, setValue] = useState(initialValue);
  return (
    <StoryPage title="Hashtag filter" description="Filter by existing hashtags.">
      <HashtagFilter
        value={value}
        onChange={setValue}
        tags={["project", "trip", "trip-2026", "crimps", "slab", "overhang", "outdoors"]}
      />
      <p role="status">Filter: {value.length > 0 ? value.join(", ") : "All hashtags"}</p>
    </StoryPage>
  );
}
export const Default: StoryObj = { render: () => <Example initialValue={[]} /> };

export const Selected: StoryObj = { render: () => <Example initialValue={["trip", "project"]} /> };
