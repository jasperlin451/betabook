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
    <PrivacyFields
      isPrivate={isPrivate}
      publicJournal={journalVisibility === "public"}
      onProfileChange={handleProfileChange}
      onJournalChange={handleJournalChange}
      isPending={isPending}
      profileError={profileError}
      journalError={journalError}
      profileDescription="Hides your profile, sends, journal, and analytics from everyone but you. Sends still count toward community ratings and suggested grades."
      journalDescription={
        isPrivate
          ? "Your private profile keeps both your journal and sends hidden. Make the profile public to share your journal."
          : "Lets anyone who can view your profile read your journal. Logging and editing stay private to you."
      }
    />
  );
}
