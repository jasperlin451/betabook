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
      <StoryPage title="Sort select">
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
