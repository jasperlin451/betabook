import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { MAX_JOURNAL_TAGS } from "@/lib/journal";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { TagInput } from "./tag-input";

const meta = { title: "Components/Journal/Tag input", component: TagInput } satisfies Meta<
  typeof TagInput
>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
function TagsExample({ full = false }: { full?: boolean }) {
  const [tags, setTags] = useState(
    full
      ? Array.from({ length: MAX_JOURNAL_TAGS }, (_, i) => `tag-${i + 1}`)
      : ["outdoors", "technique"],
  );
  return (
    <StoryPage title="Journal tags">
      <TagInput value={tags} onChange={setTags} />
    </StoryPage>
  );
}
export const JournalTags: Story = { render: () => <TagsExample /> };
export const JournalTagsFull: Story = { render: () => <TagsExample full /> };
