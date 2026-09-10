"use client";

import { DatePickerField } from "@/components/ui/date-picker-field";
import type { JournalEntry } from "@/db/queries";
import type { JournalKind } from "@/lib/journal";

type JournalEntryDateFieldsProps = {
  kind: JournalKind;
  hasClimb: boolean;
  hasPriorSend: boolean;
  existingEntry?: Pick<JournalEntry, "sent" | "isAscent">;
  today: string;
  /** ISO `YYYY-MM-DD`, or "" once cleared — a send saved without a date. */
  entryDate: string;
  /** Chosen in the owning form's session-or-send picker. */
  sent: boolean;
  onDateChange: (value: string) => void;
};

export function JournalEntryDateFields({
  kind,
  hasClimb,
  hasPriorSend,
  existingEntry,
  today,
  entryDate,
  sent,
  onDateChange,
}: JournalEntryDateFieldsProps) {
  const canMarkUnknown = !existingEntry && hasClimb && sent;
  const needsDateHint = !sent && (!!existingEntry || !hasClimb || hasPriorSend);

  return (
    <div className="flex flex-col gap-3">
      <DatePickerField
        label="Date"
        value={entryDate}
        max={today}
        isReadOnly={existingEntry?.sent}
        onChange={onDateChange}
        // I don't know appears once a send style is chosen. A first ascent
        // saved that way is recorded undated; a repeat still needs a date,
        // which submitting explains.
        onUnknownChange={
          canMarkUnknown ? (unknown) => onDateChange(unknown ? "" : today) : undefined
        }
      />

      {hasClimb && existingEntry?.sent ? (
        <p className="text-sm text-muted">
          {existingEntry.isAscent
            ? "To change the ascent date, use Edit send on the climb page."
            : "To change this repeat’s date, delete the entry and log it again."}
        </p>
      ) : needsDateHint ? (
        <p className="text-xs text-muted">
          {kind === "training"
            ? "Training entries need a date to appear in your journal."
            : "Sessions and repeats need a date to appear in your journal."}
        </p>
      ) : null}
    </div>
  );
}
