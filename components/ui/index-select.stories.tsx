import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { useArgs } from "storybook/preview-api";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { LabeledIndexSelect } from "./index-select";
import { IndexRangeSelect } from "./index-select";
const meta = {
  title: "Components/Inputs/Index select",
  component: LabeledIndexSelect,
  args: {
    label: "Grade",
    options: ["V0", "V1", "V2", "V3", "V4", "V5"],
    index: 2,
    onChange: () => {},
  },
  decorators: [
    (Story) => (
      <StoryPage title="Index select">
        <Story />
      </StoryPage>
    ),
  ],
  render: function Render(args) {
    const [, updateArgs] = useArgs();
    return <LabeledIndexSelect {...args} onChange={(index) => updateArgs({ index })} />;
  },
} satisfies Meta<typeof LabeledIndexSelect>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Range: Story = {
  render: function Range(args) {
    const [range, setRange] = useState<[number, number]>([1, 4]);
    return (
      <IndexRangeSelect
        label="Grades"
        minLabel="Minimum grade"
        maxLabel="Maximum grade"
        minOptions={args.options}
        maxOptions={args.options}
        range={range}
        onChange={setRange}
      />
    );
  },
};

export const UnboundedRange: Story = {
  render: function UnboundedRange() {
    const [range, setRange] = useState<[number, number]>([2, 0]);
    return (
      <IndexRangeSelect
        label="Count"
        minLabel="Minimum count"
        maxLabel="Maximum count"
        minOptions={["Any", "1", "2", "3", "4"]}
        maxOptions={["Any", "1", "2", "3", "4"]}
        anyIndex={0}
        range={range}
        onChange={setRange}
      />
    );
  },
};

export const RopeGrades: Story = {
  args: { label: "Min grade", options: ["5.9", "5.10a", "5.11b", "5.12c"], index: 2 },
};
