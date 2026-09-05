"use client";

import { Button } from "@heroui/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
    description: "Start here to log your climbing and training, then look back at past entries.",
  },
  {
    id: "sends-page",
    name: "Sends",
    description: "Sort your sends by date, grade, or rating.",
  },
  {
    id: "projects-page",
    name: "Projects",
    description: "Look back at attempts and plan the next session.",
  },
  {
    id: "analytics-page",
    name: "Analytics",
    description: "See what counts toward your climbing stats.",
  },
  {
    id: "account-page",
    name: "Account",
    description: "Choose who can see your journal and sends.",
  },
] as const;

export function TourDestinations({ navigate }: ProductTourStepProps) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <p>
        {TOUR_DEMO_CLIMBER.name} climbs at {TOUR_DEMO_CLIMBER.area}. We'll use this sample account
        to show you around.
      </p>
      <p className="text-muted">
        Pick a section below, or start with Journal and go through them in order.
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
              <span className="block font-medium text-foreground">{section.name} tutorial</span>
              <span className="mt-1 block text-muted">{section.description}</span>
            </span>
            <ArrowRight aria-hidden className="size-4 shrink-0 text-muted" />
          </button>
        ))}
      </div>
      <Button variant="secondary" className="self-start" onPress={() => navigate("journal-page")}>
        Start with Journal
      </Button>
    </div>
  );
}

function PageTutorial({
  page,
  href,
  children,
  demo,
  introduction,
  navigate,
  close,
}: ProductTourStepProps & {
  page: string;
  href: string;
  children: ReactNode;
  demo: ReactNode;
  introduction: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Button
        variant="secondary"
        className="self-start border border-foreground/30 text-foreground"
        onPress={() => navigate("explore")}
      >
        <ArrowLeft aria-hidden className="size-4 shrink-0" />
        All tutorials
      </Button>
      <p className="max-w-3xl text-sm leading-relaxed">{introduction}</p>
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
              <p className="text-xs text-muted">Demo account</p>
            </div>
          </div>
          <div className="p-3 sm:p-4">{demo}</div>
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
      introduction="Journal is the starting point for Betabook. Log your outdoor sessions and training here, whether you sent a climb, worked on a project, or spent an evening at the gym. These entries also keep your Sends, Projects, and Analytics up to date."
      demo={<DemoJournal />}
    >
      <h3 className="text-lg font-semibold">Find an old entry</h3>
      <p>
        Journal lists your outdoor sessions and training by date. Log each outdoor climb as a
        separate entry.
      </p>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Search notes</strong> to find something you wrote, like beta for a crux.
        </li>
        <li>
          <strong>Choose Sessions or Training</strong> to show just those entries. Select a tag to
          find other entries with the same tag.
        </li>
        <li>
          <strong>Log an entry</strong> whenever you climb or train. Use an entry's menu to edit its
          notes or tags.
        </li>
      </ul>
      <p className="text-muted">
        Alex tagged both gym drills and outdoor sessions with #footwork. Select that tag and
        Training to find the gym workout.
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
      introduction="Sends is your list of climbs you've completed. When you log your first send of a climb in Journal, it appears here with its grade, rating, and notes. Repeats stay in Journal, so each climb appears once in Sends."
      demo={<DemoSends />}
    >
      <h3 className="text-lg font-semibold">One send per climb</h3>
      <p>
        Alex sent Quiet Arete in February and repeated it in March. Sends shows the February ascent.
        Both entries are in Journal.
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
          <strong>Open a climb</strong> to see its details and send history. You can also edit your
          own send there.
        </li>
      </ul>
      <p className="text-muted">
        Sorting by Grade puts Quiet Arete first. Sorting by Rating puts Moss Ladder first.
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
      introduction="Projects keeps track of climbs you've worked on but haven't sent. Logging a session on one in Journal adds it here automatically. Use this page to look back at your attempts and pick up where you left off."
      demo={<DemoProjects />}
    >
      <h3 className="text-lg font-semibold">Your current projects</h3>
      <p>
        Alex has logged two sessions on The Long Way but hasn't sent it. That puts it in Projects
        automatically.
      </p>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Session count and last date</strong> show how much you've worked on a climb and
          when you last visited.
        </li>
        <li>
          <strong>Open a project</strong> to read its journal entries. The log button beside it
          starts a new entry for that climb.
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
      introduction="Analytics shows how your climbing adds up over time, from days outside to your hardest sends. It uses the sessions and sends you've already logged in Journal, so there's nothing extra to enter here."
      demo={<DemoAnalytics />}
    >
      <h3 className="text-lg font-semibold">What the numbers mean</h3>
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
          <strong>Outdoor days</strong> count days you climbed outside, whether you sent or not.
          Multiple climbs on one day count once. Training doesn't count.
        </li>
        <li>
          <strong>Filter by discipline</strong> on your Analytics page. The grade pyramid and
          activity calendar each have their own year selector.
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
    <PageTutorial
      {...props}
      page="Account"
      href="/account"
      introduction="Account is where you choose who can see your climbing history. Your journal starts private. Try Alex's privacy settings below to see what visitors would be able to see."
      demo={<DemoAccount />}
    >
      <h3 className="text-lg font-semibold">How the privacy settings work</h3>
      <p>
        A public profile shares sends and their notes. Notes on a first recorded ascent also appear
        on its send, even if the journal is private.
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
          <strong>Also in Account:</strong> import or export sends, change your theme, and replay
          this tour.
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
    navigationLabel: "Journal",
    title: "Start with your Journal",
    eyebrow: "1 of 5 · Journal",
    Content: JournalTutorial,
  },
  {
    id: "sends-page",
    navigationLabel: "Sends",
    title: "Find and sort your sends",
    eyebrow: "2 of 5 · Sends",
    Content: SendsTutorial,
  },
  {
    id: "projects-page",
    navigationLabel: "Projects",
    title: "Keep track of a project",
    eyebrow: "3 of 5 · Projects",
    Content: ProjectsTutorial,
  },
  {
    id: "analytics-page",
    navigationLabel: "Analytics",
    title: "Read your climbing stats",
    eyebrow: "4 of 5 · Analytics",
    Content: AnalyticsTutorial,
  },
  {
    id: "account-page",
    navigationLabel: "Account",
    title: "Try the privacy settings",
    eyebrow: "5 of 5 · Account",
    Content: AccountTutorial,
  },
];
