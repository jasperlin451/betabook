"use client";

import { Switch } from "@heroui/react";

/** Controlled fields shared by Account and the local tutorial example. Saving belongs to the caller. */
export function PrivacyFields({
  isPrivate,
  privateJournal,
  onProfileChange,
  onJournalChange,
  isPending = false,
  profileDescription,
  journalDescription,
  profileError,
  journalError,
}: {
  isPrivate: boolean;
  privateJournal: boolean;
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
        <Switch isDisabled={isPending} isSelected={isPrivate} onChange={onProfileChange}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Private profile
          </Switch.Content>
        </Switch>
        {profileDescription && <p className="text-xs text-muted">{profileDescription}</p>}
        {profileError && <p className="text-sm text-danger">{profileError}</p>}
      </div>
      <div
        className={`flex flex-col gap-1 ${journalDescription ? "border-t border-border pt-4" : ""}`}
      >
        {/* A private profile forces the journal private, so the disabled switch
            shows on rather than a stale position the journal isn't in. */}
        <Switch
          isDisabled={isPrivate || isPending}
          isSelected={isPrivate || privateJournal}
          onChange={onJournalChange}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Private journal
          </Switch.Content>
        </Switch>
        {journalDescription && <p className="text-xs text-muted">{journalDescription}</p>}
        {journalError && <p className="text-sm text-danger">{journalError}</p>}
      </div>
    </div>
  );
}
