import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { StoryPage } from "@/stories/fixtures/story-layout";

import { DatePickerField } from "./date-picker-field";

const meta = {
  title: "Components/Inputs/Date picker field",
  component: DatePickerField,
} satisfies Meta<typeof DatePickerField>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
function DateExamples() {
  const [date, setDate] = useState("");
  const [clearable, setClearable] = useState("2026-09-01");
  return (
    <StoryPage title="Date field states">
      <DatePickerField
        label="Empty date"
        value={date}
        onChange={setDate}
        max="2026-09-06"
        description="Type a date or choose one from the calendar."
      />
      <DatePickerField
        label="Clearable date"
        value={clearable}
        onChange={setClearable}
        max="2026-09-06"
        onClear={() => setClearable("")}
        description="Clear sits beside the field and leaves with the value."
      />
      <DatePickerField label="Read-only date" value="2026-09-01" onChange={() => {}} isReadOnly />
    </StoryPage>
  );
}
export const Dates: Story = { render: () => <DateExamples /> };
