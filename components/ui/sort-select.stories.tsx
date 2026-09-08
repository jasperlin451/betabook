import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useArgs } from "storybook/preview-api";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { SortSelect } from "./sort-select";
const meta = {
  title: "Components/Inputs/Sort select",
  component: SortSelect,
  args: {
    sort: "name_asc",
    fields: [
      { id: "name", label: "Name" },
      { id: "grade", label: "Grade" },
      { id: "rating", label: "Rating" },
      { id: "ascents", label: "Ascents" },
    ],
    defaultField: "name",
    defaultDirection: { name: "asc", grade: "desc", rating: "desc", ascents: "desc" },
    onNavigate: () => {},
  },
  decorators: [
    (Story) => (
      <StoryPage
        title="Sort select"
        description="A small, muted Sort by label sits to the left of the field on desktop and mobile. The direction button aligns with the field and matches its height. Shared filter toolbars place sort in a separate right-aligned results row below any expanded filter options."
      >
        <Story />
      </StoryPage>
    ),
  ],
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return (
      <>
        <SortSelect {...args} onNavigate={(sort) => updateArgs({ sort })} />
        <output>{args.sort}</output>
      </>
    );
  },
} satisfies Meta<typeof SortSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const LongestOption: Story = { args: { sort: "ascents_desc" } };
