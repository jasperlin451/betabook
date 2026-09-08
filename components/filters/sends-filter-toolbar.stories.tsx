import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useArgs } from "storybook/preview-api";

import { DEFAULT_USER_SENDS_FILTER, parseUserSendsFilter } from "@/lib/filters/user-sends-filter";
import { searchAreaFetcher } from "@/stories/fixtures/app-search-demo";
import { FilterNavigationPreview } from "@/stories/fixtures/filter-navigation-preview";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { UserSendsFilterToolbar } from "./sends-filter-toolbar";
const meta = {
  title: "Components/Filters/Sends toolbar",
  component: UserSendsFilterToolbar,
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <FilterNavigationPreview
        basePath={args.basePath}
        parseFilter={parseUserSendsFilter}
        onFilterChange={(filter) => updateArgs({ filter })}
      >
        <UserSendsFilterToolbar {...args} />
      </FilterNavigationPreview>
    );
  },
  args: {
    filter: DEFAULT_USER_SENDS_FILTER,
    basePath: "/sample/sends",
    tags: ["power", "trip"],
    areaFetcher: searchAreaFetcher,
  },
  decorators: [
    (Story) => (
      <StoryPage title="Sends filters">
        <Story />
      </StoryPage>
    ),
  ],
} satisfies Meta<typeof UserSendsFilterToolbar>;
export default meta;
export const Default: StoryObj<typeof meta> = {};
export const DateAndHashtag: StoryObj<typeof meta> = {
  args: {
    filter: {
      ...DEFAULT_USER_SENDS_FILTER,
      dateFrom: "2026-09-01",
      dateTo: "2026-09-07",
      tags: ["trip"],
    },
  },
};

export const SingleDay: StoryObj<typeof meta> = {
  args: { filter: { ...DEFAULT_USER_SENDS_FILTER, date: "2025-06-01" } },
};
export const DateRange: StoryObj<typeof meta> = {
  args: { filter: { ...DEFAULT_USER_SENDS_FILTER, dateFrom: "2025-06-01", dateTo: "2025-08-31" } },
};
