import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { SURFACE_CARD_CLASS } from "@/components/ui/card";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { JournalEntryDateFields } from "./journal-entry-date-fields";

const meta = {
  title: "Components/Journal/Entry date",
  component: JournalEntryDateFields,
  args: {
    kind: "session",
    hasClimb: true,
    hasPriorSend: false,
    today: "2026-09-06",
    entryDate: "2026-09-01",
    sent: false,
    onDateChange: () => {},
  },
  render: function Example(args) {
    const [entryDate, setEntryDate] = useState(args.entryDate);
    return (
      <StoryPage
        title="Entry date"
        description="The entry's date, with guidance for entries that must keep one. For a new send (the owning form's session-or-send picker chooses that) an I don't know checkbox appears beside the date and empties it — a send saved that way is recorded without a date, as in the Undated send example."
      >
        <div className={SURFACE_CARD_CLASS}>
          <JournalEntryDateFields {...args} entryDate={entryDate} onDateChange={setEntryDate} />
        </div>
      </StoryPage>
    );
  },
} satisfies Meta<typeof JournalEntryDateFields>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Session: Story = {};
export const Ascent: Story = { args: { sent: true } };
export const UndatedSend: Story = { args: { sent: true, entryDate: "" } };
export const Repeat: Story = { args: { sent: true, hasPriorSend: true } };
export const Training: Story = { args: { kind: "training", hasClimb: false } };
export const EditAscent: Story = {
  args: { sent: true, existingEntry: { sent: true, isAscent: true } },
};
export const EditRepeat: Story = {
  args: { sent: true, hasPriorSend: true, existingEntry: { sent: true, isAscent: false } },
};
