import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { DEFAULT_USER_SENDS_FILTER } from "@/lib/filters/user-sends-filter";
import { searchAreaFetcher } from "@/stories/fixtures/app-search-demo";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { UserSendsFilterToolbar } from "./sends-filter-toolbar";
const meta = {
  title: "Components/Filters/Sends toolbar",
  component: UserSendsFilterToolbar,
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
