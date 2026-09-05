"use client";

import { Button, buttonVariants } from "@heroui/react";
import { useState } from "react";

import { JournalEntryComposer } from "@/components/journal/journal-entry-composer";
import { profileTourSteps, TourDestinations } from "@/components/product-tours/profile-tour-pages";
import type { ProductTourStep, ProductTourStepProps } from "@/components/product-tours/types";
import { AppLink } from "@/components/ui/app-link";
import type { JournalSaveOutcome } from "@/lib/journal";

const RESULTS: Record<JournalSaveOutcome, { title: string; body: string }> = {
  training: {
    title: "Training saved",
    body: "Your training is in your journal. Add tags to find similar workouts later.",
  },
  project: {
    title: "Session saved",
    body: "You haven't logged a send for this climb yet, so it's now in Projects. You can log your next session from there.",
  },
  session: {
    title: "Session saved",
    body: "Added to your journal. You've already sent this climb, so it won't appear in open Projects.",
  },
  ascent: {
    title: "Send saved",
    body: "You'll find this entry in Journal and Sends. The climb is no longer in Projects.",
  },
  repeat: {
    title: "Repeat saved",
    body: "The repeat is in your journal. Sends still shows your original ascent, rating, and grade.",
  },
};

function TourIntroduction({ navigate }: ProductTourStepProps) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>Keep notes on attempts, sends, repeats, and training.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-secondary p-4">
          <h3 className="mb-1 font-medium">Outdoor session</h3>
          <p className="text-muted">
            One climb on one date. Log each climb separately, including attempts and repeats. Select
            “I sent” when you send.
          </p>
        </div>
        <div className="rounded-xl bg-surface-secondary p-4">
          <h3 className="mb-1 font-medium">Training</h3>
          <p className="text-muted">
            For indoor climbing, drills, strength, or conditioning. Add a note or tag; you don't
            need to choose a climb.
          </p>
        </div>
      </div>
      <p className="text-muted">
        Climbs you've worked on but haven't sent appear in Projects automatically. Your first
        recorded send adds an ascent to Sends; later sends are repeats.
      </p>
      <p className="rounded-lg border border-border p-4 text-muted">
        Journals start private. Notes on your first recorded ascent also appear on its send and
        follow your profile's privacy settings, even when the journal is private. Check your privacy
        settings in Account.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onPress={() => navigate("compose")}>Log my own entry</Button>
        <Button variant="ghost" onPress={() => navigate("explore")}>
          Explore the demo
        </Button>
      </div>
    </div>
  );
}

function LogEntryStep({ navigate }: ProductTourStepProps) {
  const [pending, setPending] = useState(false);
  return (
    <>
      <p className="text-sm font-medium">This saves an entry to your journal.</p>
      <JournalEntryComposer
        onPendingChange={setPending}
        guided
        onDone={() => navigate("explore")}
        onCreated={(outcome) => navigate("saved", { outcome })}
      />
      <Button variant="ghost" onPress={() => navigate("intro")} isDisabled={pending}>
        Back to introduction
      </Button>
    </>
  );
}

function SavedEntryStep({ values, navigate, userId, close }: ProductTourStepProps) {
  const result = RESULTS[values.outcome as JournalSaveOutcome];
  if (!result) return <Button onPress={() => navigate("explore")}>Choose a tutorial</Button>;
  return (
    <>
      <div role="status" className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">{result.title}</h3>
        <p className="text-sm text-muted">{result.body}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <AppLink href={`/users/${userId}/journal`} onClick={close} className={buttonVariants()}>
          Open my Journal
        </AppLink>
        <Button variant="ghost" onPress={() => navigate("explore")}>
          Explore the tutorials
        </Button>
      </div>
    </>
  );
}

export const journalTourSteps: readonly ProductTourStep[] = [
  {
    id: "intro",
    title: "Log a session or a workout",
    eyebrow: "Getting started",
    Content: TourIntroduction,
    navigation: "custom",
  },
  {
    id: "compose",
    title: "Add an entry to your journal",
    eyebrow: "Your journal",
    Content: LogEntryStep,
    navigation: "custom",
  },
  {
    id: "saved",
    title: "Entry saved",
    eyebrow: "What happens next",
    Content: SavedEntryStep,
    navigation: "custom",
  },
  {
    id: "explore",
    title: "Choose a tutorial",
    navigationLabel: "Tutorials",
    eyebrow: "Your logbook",
    Content: TourDestinations,
    navigation: "custom",
    canFinish: true,
  },
  ...profileTourSteps,
];
