import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useArgs } from "storybook/preview-api";

import { DEFAULT_JOURNAL_FILTER, parseJournalFilter } from "@/lib/filters/journal-filter";
import { FilterNavigationPreview } from "@/stories/fixtures/filter-navigation-preview";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { JournalFilterToolbar } from "./journal-filter-toolbar";

const meta = {
  title: "Components/Filters/Journal toolbar",
  component: JournalFilterToolbar,
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <FilterNavigationPreview
        basePath={`/users/${args.userId}/journal`}
        parseFilter={parseJournalFilter}
        onFilterChange={(filter) => updateArgs({ filter })}
      >
        <JournalFilterToolbar {...args} />
      </FilterNavigationPreview>
    );
  },
  args: {
    userId: "example",
    filter: DEFAULT_JOURNAL_FILTER,
    climbName: null,
    tags: ["power", "strength", "trip"],
  },
  decorators: [
    (Story) => (
      <StoryPage title="Journal filters" description="Filter entries or select existing hashtags.">
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

export const SingleDay: StoryObj<typeof meta> = {
  args: { filter: { ...DEFAULT_JOURNAL_FILTER, date: "2025-06-01" } },
};
export const DateRange: StoryObj<typeof meta> = {
  args: { filter: { ...DEFAULT_JOURNAL_FILTER, dateFrom: "2025-06-01", dateTo: "2025-08-31" } },
};
