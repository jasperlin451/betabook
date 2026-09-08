import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { SelectionDemo } from "@/stories/fixtures/search-demo";

import { SearchSelectionField } from "./search-selection-field";

const meta = {
  title: "Components/Search/Selection field",
  component: SearchSelectionField,
} satisfies Meta<typeof SearchSelectionField>;
export default meta;
type Story = StoryObj;
export const Area: Story = { render: () => <SelectionDemo /> };
export const Companion: Story = { render: () => <SelectionDemo kind="climber" /> };
