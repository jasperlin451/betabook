import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { Grade } from "./grade";
import { ListRow } from "./list-row";
const meta = {
  title: "Components/Data display/List row",
  component: ListRow,
  args: {
    title: "Cedar Arete",
    subtitle: "North Woods",
    trailing: <Grade>V4</Grade>,
    comment: "A short note.",
  },
  decorators: [
    (Story) => (
      <StoryPage title="List row">
        <Story />
      </StoryPage>
    ),
  ],
} satisfies Meta<typeof ListRow>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const LongContent: Story = {
  args: {
    title: "A very long route name that wraps without hiding the trailing grade",
    subtitle: "A long area name at the far end of the valley",
    trailing: <Grade>5.11a</Grade>,
  },
};
