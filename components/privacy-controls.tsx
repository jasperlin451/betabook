"use client";

import { useState, useTransition } from "react";

import { setJournalVisibility, setUserPrivate } from "@/actions";
import { PrivacyFields } from "@/components/privacy-fields";
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

  function handleJournalChange(nextPrivate: boolean) {
    const next = nextPrivate ? "private" : "public";
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
    <PrivacyFields
      isPrivate={isPrivate}
      privateJournal={journalVisibility === "private"}
      onProfileChange={handleProfileChange}
      onJournalChange={handleJournalChange}
      isPending={isPending}
      profileError={profileError}
      journalError={journalError}
      profileDescription="Hides your profile, sends, journal, and analytics from everyone but you. Sends still count toward community ratings and suggested grades."
      journalDescription={
        isPrivate
          ? "Your private profile keeps both your journal and sends hidden. Make the profile public to share your journal."
          : "Hides your journal from people who can view your profile. Logging and editing always stay private to you."
      }
    />
  );
}
