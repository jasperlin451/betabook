"use client";

import { Checkbox } from "@heroui/react";

/** Controlled fields shared by Account and the local tutorial example. Saving belongs to the caller. */
export function PrivacyFields({
  isPrivate,
  publicJournal,
  onProfileChange,
  onJournalChange,
  isPending = false,
  profileDescription,
  journalDescription,
  profileError,
  journalError,
}: {
  isPrivate: boolean;
  publicJournal: boolean;
  onProfileChange: (value: boolean) => void;
  onJournalChange: (value: boolean) => void;
  isPending?: boolean;
  profileDescription?: string;
  journalDescription?: string;
  profileError?: string | null;
  journalError?: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Checkbox isDisabled={isPending} isSelected={isPrivate} onChange={onProfileChange}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Private profile
          </Checkbox.Content>
        </Checkbox>
        {profileDescription && <p className="text-xs text-muted">{profileDescription}</p>}
        {profileError && <p className="text-sm text-danger">{profileError}</p>}
      </div>
      <div
        className={`flex flex-col gap-1 ${journalDescription ? "border-t border-border pt-4" : ""}`}
      >
        <Checkbox
          isDisabled={isPrivate || isPending}
          isSelected={publicJournal}
          onChange={onJournalChange}
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Public journal
          </Checkbox.Content>
        </Checkbox>
        {journalDescription && <p className="text-xs text-muted">{journalDescription}</p>}
        {journalError && <p className="text-sm text-danger">{journalError}</p>}
      </div>
    </div>
  );
}
