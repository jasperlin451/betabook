import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LocalFiltersDemo } from "@/stories/fixtures/filter-demo";
const meta = { title: "Patterns/Filters", component: LocalFiltersDemo } satisfies Meta<
  typeof LocalFiltersDemo
>;
export default meta;
type Story = StoryObj;
export const AreaClimbs: Story = { render: () => <LocalFiltersDemo /> };
export const Sends: Story = { render: () => <LocalFiltersDemo list="sends" /> };
export const Journal: Story = { render: () => <LocalFiltersDemo list="journal" /> };
