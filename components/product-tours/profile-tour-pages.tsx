"use client";

import { Button } from "@heroui/react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import {
  DemoAccount,
  DemoAnalytics,
  DemoJournal,
  DemoProjects,
  DemoSends,
} from "@/components/product-tours/profile-tour-previews";
import type { ProductTourStep, ProductTourStepProps } from "@/components/product-tours/types";
import { AppLink } from "@/components/ui/app-link";
import { TOUR_DEMO_CLIMBER } from "@/lib/product-tour-demo";

const SECTIONS = [
  {
    id: "journal-page",
    name: "Journal",
    description: "Find sessions and training with search, filters, and tags.",
  },
  {
    id: "sends-page",
    name: "Sends",
    description: "Explore recorded ascents, grades, ratings, and styles.",
  },
  {
    id: "projects-page",
    name: "Projects",
    description: "Look back at attempts and plan the next session.",
  },
  {
    id: "analytics-page",
    name: "Analytics",
    description: "Understand outdoor days and send progression.",
  },
  {
    id: "account-page",
    name: "Account",
    description: "Try privacy controls and find your account tools.",
  },
] as const;

export function TourDestinations({ navigate }: ProductTourStepProps) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <p>
        Meet {TOUR_DEMO_CLIMBER.name}, our fictional demo climber. Explore a populated logbook with
        eight journal entries, three sends, and a project in {TOUR_DEMO_CLIMBER.area}.
      </p>
      <p className="text-muted">
        Choose a tutorial to try its controls with Alex's sample data, or walk through every section
        in order.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => navigate(section.id)}
            className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-surface-secondary focus-visible:status-focused"
          >
            <span className="flex-1">
              <span className="block font-medium text-foreground">Explore {section.name}</span>
              <span className="mt-1 block text-muted">{section.description}</span>
            </span>
            <ArrowRight aria-hidden className="size-4 shrink-0 text-muted" />
          </button>
        ))}
      </div>
      <Button variant="secondary" className="self-start" onPress={() => navigate("journal-page")}>
        Walk through every section
      </Button>
    </div>
  );
}

function PageTutorial({
  page,
  href,
  children,
  demo,
  navigate,
  close,
}: ProductTourStepProps & {
  page: string;
  href: string;
  children: ReactNode;
  demo: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Button variant="ghost" className="self-start" onPress={() => navigate("explore")}>
        All tutorials
      </Button>
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-label={`Alex's ${page} example`}
          className="min-w-0 overflow-hidden rounded-xl border border-border"
        >
          <div className="flex items-center gap-3 border-b border-border bg-surface-secondary p-4">
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground"
            >
              {TOUR_DEMO_CLIMBER.initials}
            </span>
            <div>
              <h3 className="font-medium text-foreground">
                {TOUR_DEMO_CLIMBER.name} · {page}
              </h3>
              <p className="text-xs text-muted">Fictional demo account · Try the controls below</p>
            </div>
          </div>
          <div className="p-3 sm:p-4">{demo}</div>
          <p className="border-t border-border px-4 py-3 text-xs text-muted">
            Sample data. Changes here stay in this example.
          </p>
        </section>
        <div className="flex flex-col gap-4 text-sm leading-relaxed">
          {children}
          <AppLink href={href} onClick={close} className="self-start font-medium">
            Open my {page} →
          </AppLink>
        </div>
      </div>
    </div>
  );
}

function JournalTutorial(props: ProductTourStepProps) {
  return (
    <PageTutorial
      {...props}
      page="Journal"
      href={`/users/${props.userId}/journal`}
      demo={<DemoJournal />}
    >
      <h3 className="text-lg font-semibold">Remember what worked</h3>
      <p>
        Your journal brings outdoor sessions, repeat ascents, and training into one timeline. Each
        outdoor entry belongs to one climb on one date.
      </p>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Search notes</strong> to recover a detail, like Alex's quieter feet or next crux
          sequence.
        </li>
        <li>
          <strong>Choose Sessions or Training</strong> to narrow the timeline. Select a tag to
          connect related entries across days.
        </li>
        <li>
          <strong>Log an entry</strong> whenever you climb or train. Use an entry's menu to edit its
          notes or tags.
        </li>
      </ul>
      <p className="text-muted">
        Try #footwork: it connects Alex's gym drills, repeat, send, and project session. Combine it
        with Training to find just the workout.
      </p>
    </PageTutorial>
  );
}

function SendsTutorial(props: ProductTourStepProps) {
  return (
    <PageTutorial
      {...props}
      page="Sends"
      href={`/users/${props.userId}/sends`}
      demo={<DemoSends />}
    >
      <h3 className="text-lg font-semibold">Your recorded ascents</h3>
      <p>
        Alex sent Quiet Arete in February and repeated it in March. Sends keeps the original ascent;
        Journal tells the story of both days.
      </p>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Sort by Date, Grade, or Rating</strong> to find recent sends, your hardest climbs,
          or favorites. On your page you can also reverse the order.
        </li>
        <li>
          <strong>Search climb and area names</strong>, filter by discipline and grade, or use More
          filters for ascent styles and ratings.
        </li>
        <li>
          <strong>Open a climb</strong> to see its details and send history. Your own send has
          controls for editing its ascent details.
        </li>
      </ul>
      <p className="text-muted">
        Select Grade: Quiet Arete rises to the top. Select Rating: Alex's favorite, Moss Ladder,
        comes first.
      </p>
    </PageTutorial>
  );
}

function ProjectsTutorial(props: ProductTourStepProps) {
  return (
    <PageTutorial
      {...props}
      page="Projects"
      href={`/users/${props.userId}/projects`}
      demo={<DemoProjects />}
    >
      <h3 className="text-lg font-semibold">Pick up where you left off</h3>
      <p>
        The Long Way appears here because Alex logged outdoor sessions on it without a send.
        Projects is built from your climbing history automatically.
      </p>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Session count and last date</strong> show how much you've worked on a climb and
          when you last visited.
        </li>
        <li>
          <strong>Open a project</strong> to revisit its journal entries. Use the log control beside
          it to start another entry with that climb selected.
        </li>
        <li>
          <strong>Select “I sent”</strong> when you finish it. Its first ascent goes to Sends and
          the climb leaves open Projects.
        </li>
      </ul>
      <p className="text-muted">
        Only you can see your Projects list, even with a public profile. Open Alex's sessions for a
        reminder of the next move to try.
      </p>
    </PageTutorial>
  );
}

function AnalyticsTutorial(props: ProductTourStepProps) {
  return (
    <PageTutorial
      {...props}
      page="Analytics"
      href={`/users/${props.userId}/analytics`}
      demo={<DemoAnalytics />}
    >
      <h3 className="text-lg font-semibold">Read the story behind the numbers</h3>
      <p>
        Alex has six outdoor entries across four dates, plus two training entries. That gives four
        days out and three sends.
      </p>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Progression</strong> marks each month's hardest send with a dot. The stepped line
          tracks your personal best, even when a later month is easier.
        </li>
        <li>
          <strong>Outdoor days</strong> count distinct dates, including sessions without a send.
          Multiple climbs on the same date count once; training is excluded.
        </li>
        <li>
          <strong>Explore your page</strong> by discipline. The grade pyramid and activity calendar
          each have their own year selector.
        </li>
      </ul>
      <p className="text-muted">
        Alex's first send of Quiet Arete raised the personal best to V4. Repeating it adds an
        outdoor session, without adding another send.
      </p>
    </PageTutorial>
  );
}

function AccountTutorial(props: ProductTourStepProps) {
  return (
    <PageTutorial {...props} page="Account" href="/account" demo={<DemoAccount />}>
      <h3 className="text-lg font-semibold">Choose what you share</h3>
      <p>
        Journals start private. A public profile still shares sends and their notes. Notes on a
        first recorded ascent also appear on its send, even if the journal is private.
      </p>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Private profile</strong> hides your profile, sends, journal, and analytics. Sends
          still contribute to community ratings and suggested grades.
        </li>
        <li>
          <strong>Public journal</strong> shares sessions and training with people who can view your
          profile. A private profile overrides this setting.
        </li>
        <li>
          <strong>Account tools</strong> include send import and export, appearance, and Replay
          product tour whenever you need a refresher.
        </li>
      </ul>
      <p className="text-muted">
        Turn on Public journal in the example, then Private profile to see how the settings work
        together.
      </p>
    </PageTutorial>
  );
}

export const profileTourSteps: readonly ProductTourStep[] = [
  {
    id: "journal-page",
    title: "Find the details in your journal",
    eyebrow: "1 of 5 · Journal",
    Content: JournalTutorial,
  },
  {
    id: "sends-page",
    title: "Explore your sends",
    eyebrow: "2 of 5 · Sends",
    Content: SendsTutorial,
  },
  {
    id: "projects-page",
    title: "Return to an unfinished climb",
    eyebrow: "3 of 5 · Projects",
    Content: ProjectsTutorial,
  },
  {
    id: "analytics-page",
    title: "Understand your progress",
    eyebrow: "4 of 5 · Analytics",
    Content: AnalyticsTutorial,
  },
  {
    id: "account-page",
    title: "Make your account your own",
    eyebrow: "5 of 5 · Account",
    Content: AccountTutorial,
  },
];
