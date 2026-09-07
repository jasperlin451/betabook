import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DEFAULT_JOURNAL_FILTER } from "@/lib/journal-filter";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { JournalFilterToolbar } from "./journal-filter-toolbar";

const meta = {
  title: "Components/Journal/Filter toolbar",
  component: JournalFilterToolbar,
  args: {
    userId: "example",
    filter: DEFAULT_JOURNAL_FILTER,
    climbName: null,
    tags: ["power", "strength", "trip"],
  },
  decorators: [
    (Story) => (
      <StoryPage title="Journal filters" description="Search entries or select existing hashtags.">
        <Story />
      </StoryPage>
    ),
  ],
} satisfies Meta<typeof JournalFilterToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = {
  args: { filter: { ...DEFAULT_JOURNAL_FILTER, tags: ["power", "trip"] } },
};
