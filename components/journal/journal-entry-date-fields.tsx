"use client";

import { Checkbox } from "@heroui/react";
import type { ReactNode } from "react";

import { DatePickerField } from "@/components/ui/date-picker-field";
import type { JournalEntry } from "@/db/queries";
import type { JournalKind } from "@/lib/journal";

type JournalEntryDateFieldsProps = {
  ascentStyle?: ReactNode;
  kind: JournalKind;
  hasClimb: boolean;
  hasPriorSend: boolean;
  existingEntry?: Pick<JournalEntry, "sent" | "isAscent">;
  today: string;
  /** ISO `YYYY-MM-DD`, or "" once cleared — a send saved without a date. */
  entryDate: string;
  sent: boolean;
  onDateChange: (value: string) => void;
  onSentChange: (value: boolean) => void;
};

export function JournalEntryDateFields({
  kind,
  ascentStyle,
  hasClimb,
  hasPriorSend,
  existingEntry,
  today,
  entryDate,
  sent,
  onDateChange,
  onSentChange,
}: JournalEntryDateFieldsProps) {
  const canRecordUndatedSend = !existingEntry && hasClimb && !hasPriorSend;

  return (
    <div className="flex flex-col gap-3">
      <DatePickerField
        label="Date"
        value={entryDate}
        max={today}
        isReadOnly={existingEntry?.sent}
        onChange={onDateChange}
        // Only a new entry can become an undated send; edits keep their date.
        onClear={existingEntry ? undefined : () => onDateChange("")}
      />

      {hasClimb && !existingEntry && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Checkbox isSelected={sent} onChange={onSentChange}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              I sent
            </Checkbox.Content>
          </Checkbox>
          {sent && ascentStyle}
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
    </div>
  );
}
