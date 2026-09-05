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
    body: "Your workout is in Journal.",
  },
  project: {
    title: "Session saved",
    body: "This climb is now in Projects. Log your next attempt there.",
  },
  session: {
    title: "Session saved",
    body: "Added to Journal. You've already sent this climb, so it stays out of Projects.",
  },
  ascent: {
    title: "Send saved",
    body: "Added to Journal and Sends, and removed from Projects.",
  },
  repeat: {
    title: "Repeat saved",
    body: "Added to Journal. Sends keeps your original ascent.",
  },
};

function TourIntroduction({ navigate }: ProductTourStepProps) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-surface-secondary p-4">
          <h3 className="mb-1 font-medium">Outdoor session</h3>
          <p className="text-muted">
            One climb per entry, including attempts and repeats. Select “I sent” when you send.
          </p>
        </div>
        <div className="rounded-xl bg-surface-secondary p-4">
          <h3 className="mb-1 font-medium">Training</h3>
          <p className="text-muted">
            Indoor climbing, drills, or strength work. No climb required.
          </p>
        </div>
      </div>
      <p className="rounded-lg border border-border p-4 text-muted">
        Your journal starts private. First-send notes also appear on Sends, where your profile's
        privacy settings apply.
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
