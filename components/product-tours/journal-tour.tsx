"use client";

import { Button } from "@heroui/react";
import { useState } from "react";

import { JournalEntryComposer } from "@/components/journal/journal-entry-composer";
import type { ProductTourStep, ProductTourStepProps } from "@/components/product-tours/types";
import { AppLink } from "@/components/ui/app-link";
import type { JournalSaveOutcome } from "@/lib/journal";

const RESULTS: Record<JournalSaveOutcome, { title: string; body: string }> = {
  training: {
    title: "Training saved",
    body: "Your training is in your journal. Add tags to find similar workouts later.",
  },
  project: {
    title: "Session saved — keep working on it",
    body: "This climb appears in Projects because you've logged a session and haven't recorded a send. Log your next session from there.",
  },
  session: {
    title: "Session saved",
    body: "Added to your journal. You've already sent this climb, so it won't appear in open Projects.",
  },
  ascent: {
    title: "Your ascent is recorded",
    body: "This session is in your journal, and your ascent is also in Sends. This climb no longer appears in open Projects.",
  },
  repeat: {
    title: "Repeat saved",
    body: "Added to your journal. Your original ascent stays recorded in Sends, with its rating and grade unchanged.",
  },
};

function TourIntroduction({ navigate }: ProductTourStepProps) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>You don't have to send to have something worth recording.</p>
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
            Indoor climbing, drills, strength, or conditioning. No climb selection needed — just a
            note or a tag.
          </p>
        </div>
      </div>
      <p className="text-muted">
        Climbs you've worked on but haven't sent appear in Projects automatically. Your first
        recorded send adds an ascent to Sends; later sends are repeats.
      </p>
      <p className="rounded-lg border border-border p-4 text-muted">
        Journals start private. Notes on your first recorded ascent also appear on its send and
        follow your profile's privacy settings, even when the journal is private. Review visibility
        in Account.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onPress={() => navigate("compose")}>Try logging an entry</Button>
        <Button variant="ghost" onPress={() => navigate("explore")}>
          Just show me around
        </Button>
      </div>
    </div>
  );
}

function TourDestinations({ userId, close }: ProductTourStepProps) {
  const base = `/users/${userId}`;
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>Use these sections on your profile whenever you want to look back or log more.</p>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="font-medium">
            <AppLink onClick={close} href={`${base}/journal`}>
              Journal
            </AppLink>
          </dt>
          <dd className="mt-1 text-muted">
            Your sessions and training. Search notes, filter by entry type, or select a tag to find
            related entries.
          </dd>
        </div>
        <div>
          <dt className="font-medium">
            <AppLink onClick={close} href={`${base}/sends`}>
              Sends
            </AppLink>
          </dt>
          <dd className="mt-1 text-muted">
            Your recorded ascents, with grades, ratings, and notes. Repeats stay in the journal.
          </dd>
        </div>
        <div>
          <dt className="font-medium">
            <AppLink onClick={close} href={`${base}/projects`}>
              Projects
            </AppLink>
          </dt>
          <dd className="mt-1 text-muted">
            Only you see this list of climbs you've worked on but haven't sent. Log the next session
            from here.
          </dd>
        </div>
        <div>
          <dt className="font-medium">
            <AppLink onClick={close} href={`${base}/analytics`}>
              Analytics
            </AppLink>
          </dt>
          <dd className="mt-1 text-muted">
            Explore outdoor climbing days and send progression. Multiple climbs on one date count as
            one day out; training doesn't count toward outdoor days.
          </dd>
        </div>
      </dl>
      <p className="text-muted">
        Find privacy controls, send import, and Replay product tour in{" "}
        <AppLink onClick={close} href="/account">
          Account
        </AppLink>
        .
      </p>
    </div>
  );
}

function LogEntryStep({ navigate }: ProductTourStepProps) {
  const [pending, setPending] = useState(false);
  return (
    <>
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

function SavedEntryStep({ values, navigate }: ProductTourStepProps) {
  const result = RESULTS[values.outcome as JournalSaveOutcome];
  if (!result) return <Button onPress={() => navigate("explore")}>Explore your journal</Button>;
  return (
    <>
      <div role="status" className="flex flex-col gap-2">
        <h3 className="text-lg font-medium">{result.title}</h3>
        <p className="text-sm text-muted">{result.body}</p>
      </div>
      <Button onPress={() => navigate("explore")}>Where to find it</Button>
    </>
  );
}

export const journalTourSteps: readonly ProductTourStep[] = [
  {
    id: "intro",
    title: "Make room for every climbing day",
    eyebrow: "Getting started",
    Content: TourIntroduction,
    navigation: "custom",
  },
  {
    id: "compose",
    title: "Log something you actually did",
    eyebrow: "Try it",
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
    title: "Find your next session and your progress",
    eyebrow: "Your climbing history",
    Content: TourDestinations,
    navigation: "custom",
  },
];
