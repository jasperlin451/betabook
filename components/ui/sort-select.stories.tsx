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
    ],
    defaultField: "name",
    defaultDirection: { name: "asc", grade: "desc" },
    onNavigate: () => {},
  },
  decorators: [
    (Story) => (
      <StoryPage
        title="Sort select"
        description="A small Sort by label sits above the field at every screen size. Search, sort, and direction controls share the same responsive field height, including the theme border. Tab to the direction button and press Enter to reverse the order."
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

export const GradeDescending: Story = {
  args: { sort: "grade_desc" },
};

export const Sends: Story = {
  args: {
    sort: "date_desc",
    fields: [
      { id: "date", label: "Date" },
      { id: "grade", label: "Grade" },
      { id: "rating", label: "Rating" },
    ],
    defaultField: "date",
    defaultDirection: { date: "desc", grade: "desc", rating: "desc" },
  },
};
