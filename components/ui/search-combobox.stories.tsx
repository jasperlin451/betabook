import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { SearchCombobox } from "./search-combobox";

const meta = {
  title: "Components/Inputs/Search combobox",
  component: SearchCombobox,
} satisfies Meta<typeof SearchCombobox>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
const climbs = [
  { id: "cedar", name: "Cedar Arete" },
  { id: "north", name: "North Face" },
  { id: "long", name: "A very long climb name above the cedar grove" },
];
function SearchExample() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("None");
  return (
    <StoryPage
      title="Search combobox"
      description="Type cedar for results, or zzz for an empty list. The real debounce and keyboard behavior run against a local fixture fetcher."
    >
      <SearchCombobox
        label="Find a climb"
        value={query}
        onChange={setQuery}
        fetcher={async (query) =>
          climbs.filter((climb) => climb.name.toLowerCase().includes(query.toLowerCase()))
        }
        itemKey={(climb) => climb.id}
        itemText={(climb) => climb.name}
        renderItem={(climb) => climb.name}
        onSelect={(climb) => {
          setQuery(climb.name);
          setSelected(climb.name);
        }}
        placeholder="Search climbs…"
        idleMessage="Type a climb name."
        emptyMessage="No matching climbs."
        fullWidth
      />
      <p role="status">Selected: {selected}</p>
    </StoryPage>
  );
}
export const Search: Story = { render: () => <SearchExample /> };
