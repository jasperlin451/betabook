"use client";

import { Checkbox } from "@heroui/react";
import { useState, useTransition } from "react";

import { setJournalVisibility, setUserPrivate } from "@/actions";
import type { JournalVisibility } from "@/lib/journal";

export function PrivacyControls({
  initialIsPrivate,
  initialJournalVisibility,
}: {
  initialIsPrivate: boolean;
  initialJournalVisibility: JournalVisibility;
}) {
  const [isPrivate, setIsPrivate] = useState(initialIsPrivate);
  const [journalVisibility, setJournalVisibilityState] =
    useState<JournalVisibility>(initialJournalVisibility);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [journalError, setJournalError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleProfileChange(next: boolean) {
    setIsPrivate(next);
    setProfileError(null);
    startTransition(async () => {
      const result = await setUserPrivate(next);
      if (!result.ok) {
        setIsPrivate(!next);
        setProfileError(result.error);
      }
    });
  }

  function handleJournalChange(isPublic: boolean) {
    const next = isPublic ? "public" : "private";
    const previous = journalVisibility;
    setJournalVisibilityState(next);
    setJournalError(null);
    startTransition(async () => {
      const result = await setJournalVisibility(next);
      if (!result.ok) {
        setJournalVisibilityState(previous);
        setJournalError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Checkbox isDisabled={isPending} isSelected={isPrivate} onChange={handleProfileChange}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Private profile
          </Checkbox.Content>
        </Checkbox>
        <p className="text-xs text-muted">
          Hides your profile, sends, journal, and analytics from everyone but you. Sends still count
          toward community ratings and suggested grades.
        </p>
        {profileError && <p className="text-sm text-danger">{profileError}</p>}
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <Checkbox
          isDisabled={isPrivate || isPending}
          isSelected={journalVisibility === "public"}
          onChange={handleJournalChange}
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Public journal
          </Checkbox.Content>
        </Checkbox>
        <p className="text-xs text-muted">
          {isPrivate
            ? "Your private profile keeps both your journal and sends hidden. Make the profile public to share your journal."
            : "Lets anyone who can view your profile read your journal. Logging and editing stay private to you."}
        </p>
        {journalError && <p className="text-sm text-danger">{journalError}</p>}
      </div>
    </div>
  );
}
