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
  entryDate: string;
  sent: boolean;
  dateUnknown: boolean;
  onDateChange: (value: string) => void;
  onSentChange: (value: boolean) => void;
  onDateUnknownChange: (value: boolean) => void;
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
  dateUnknown,
  onDateChange,
  onSentChange,
  onDateUnknownChange,
}: JournalEntryDateFieldsProps) {
  const canRecordUndatedSend = !existingEntry && hasClimb && !hasPriorSend;
  const isUndatedSend = canRecordUndatedSend && sent && dateUnknown;

  return (
    <div className="flex flex-col gap-3">
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
            onChange={(value) => {
              if (value) onSentChange(true);
              onDateUnknownChange(value);
            }}
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              Record a send without a date
            </Checkbox.Content>
          </Checkbox>
        </div>
      )}

      {hasClimb && !existingEntry && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
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
