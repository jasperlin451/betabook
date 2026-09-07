"use client";

import { Checkbox } from "@heroui/react";
import { useId } from "react";

import { FormSection } from "@/components/send-fields";
import { DatePickerField } from "@/components/ui/date-picker-field";
import type { JournalEntry } from "@/db/queries";
import type { JournalKind } from "@/lib/journal";

type JournalEntryDateFieldsProps = {
  kind: JournalKind;
  hasClimb: boolean;
  hasPriorSend: boolean;
  existingEntry?: Pick<JournalEntry, "sent" | "isAscent">;
  today: string;
  entryDate: string;
  sent: boolean;
  dateUnknown: boolean;
  onDateChange: (value: string) => void;
  onSentChange: (value: boolean) => void;
  onDateUnknownChange: (value: boolean) => void;
};

export function JournalEntryDateFields({
  kind,
  hasClimb,
  hasPriorSend,
  existingEntry,
  today,
  entryDate,
  sent,
  dateUnknown,
  onDateChange,
  onSentChange,
  onDateUnknownChange,
}: JournalEntryDateFieldsProps) {
  const dateHelpId = useId();
  const canRecordUndatedSend = !existingEntry && hasClimb && !hasPriorSend;
  const isUndatedSend = canRecordUndatedSend && sent && dateUnknown;

  return (
    <FormSection label="The day">
      {hasClimb && !existingEntry && (
        <Checkbox
          isSelected={sent}
          onChange={(value) => {
            onSentChange(value);
            if (!value) onDateUnknownChange(false);
          }}
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            I sent
          </Checkbox.Content>
        </Checkbox>
      )}

      {!isUndatedSend && (
        <DatePickerField
          label="Date"
          value={entryDate}
          max={today}
          isReadOnly={existingEntry?.sent}
          onChange={onDateChange}
        />
      )}

      {canRecordUndatedSend && (
        <div className="flex flex-col gap-1">
          <Checkbox
            isSelected={sent && dateUnknown}
            isDisabled={!sent}
            onChange={onDateUnknownChange}
            aria-describedby={dateHelpId}
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              I don&apos;t remember the date
            </Checkbox.Content>
          </Checkbox>
          <p id={dateHelpId} className="text-xs text-muted">
            {sent
              ? "Saved in Sends. Add a date later to include it in your journal."
              : "Sessions need a date. Select “I sent” to record a send without one."}
          </p>
        </div>
      )}

      {hasClimb && existingEntry?.sent ? (
        <p className="text-sm text-muted">
          {existingEntry.isAscent
            ? "To change the ascent date, use Edit send on the climb page."
            : "To change this repeat’s date, delete the entry and log it again."}
        </p>
      ) : !canRecordUndatedSend ? (
        <p className="text-xs text-muted">
          {kind === "training"
            ? "Training entries need a date to appear in your journal."
            : "Sessions and repeats need a date to appear in your journal."}
        </p>
      ) : null}
    </FormSection>
  );
}
