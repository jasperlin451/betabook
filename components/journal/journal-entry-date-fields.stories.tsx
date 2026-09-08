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
    dateUnknown: false,
    onDateChange: () => {},
    onSentChange: () => {},
    onDateUnknownChange: () => {},
  },
  render: function Example(args) {
    const [entryDate, setEntryDate] = useState(args.entryDate);
    const [sent, setSent] = useState(args.sent);
    const [dateUnknown, setDateUnknown] = useState(args.dateUnknown);
    return (
      <StoryPage
        title="Entry date"
        description="Date choices for sessions, sends, and training. Record without a date selects I sent and hides the date; uncheck it to restore the date."
      >
        <div className={SURFACE_CARD_CLASS}>
          <JournalEntryDateFields
            {...args}
            entryDate={entryDate}
            sent={sent}
            dateUnknown={dateUnknown}
            onDateChange={setEntryDate}
            onSentChange={setSent}
            onDateUnknownChange={setDateUnknown}
          />
        </div>
      </StoryPage>
    );
  },
} satisfies Meta<typeof JournalEntryDateFields>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Session: Story = {};
export const Ascent: Story = { args: { sent: true } };
export const UndatedSend: Story = { args: { sent: true, dateUnknown: true } };
export const Repeat: Story = { args: { sent: true, hasPriorSend: true } };
export const Training: Story = { args: { kind: "training", hasClimb: false } };
export const EditAscent: Story = {
  args: { sent: true, existingEntry: { sent: true, isAscent: true } },
};
export const EditRepeat: Story = {
  args: { sent: true, hasPriorSend: true, existingEntry: { sent: true, isAscent: false } },
};
