import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import type { CompanionOption } from "@/lib/journal-companions";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { CompanionPicker } from "./companion-picker";

const meta = {
  title: "Components/Journal/Companion picker",
  component: CompanionPicker,
} satisfies Meta<typeof CompanionPicker>;
export default meta;
type Story = StoryObj;
const friends = [
  { id: "alex", name: "Alex Rivera" },
  { id: "sam", name: "Sam With A Long Climbing Name" },
  { id: "jo", name: "Jordan Lee" },
];
function Example({
  full = false,
  failure = false,
  disabled = false,
}: {
  full?: boolean;
  failure?: boolean;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<CompanionOption[]>(
    full
      ? Array.from({ length: 10 }, (_, id) => ({
          id: String(id),
          name: `Climbing friend ${id + 1}`,
        }))
      : failure
        ? [friends[1]]
        : [],
  );
  return (
    <StoryPage
      title="With friends"
      description="Companions belong to one journal entry. Select Alex, then type Sam to add another friend; each selection closes the menu and keeps the search ready."
    >
      <CompanionPicker
        value={selected}
        onChange={setSelected}
        editing
        disabled={disabled}
        fetcher={async (query) => {
          if (failure) throw new Error("Sample connection failure");
          return friends.filter((friend) =>
            friend.name.toLowerCase().startsWith(query.toLowerCase()),
          );
        }}
      />
    </StoryPage>
  );
}
export const Selection: Story = { render: () => <Example /> };
export const Maximum: Story = { render: () => <Example full /> };
export const Unavailable: Story = { render: () => <Example failure /> };
export const Saving: Story = { render: () => <Example full disabled /> };
