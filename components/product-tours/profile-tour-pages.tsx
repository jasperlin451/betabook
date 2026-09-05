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
    description: "Log climbing and training.",
  },
  {
    id: "sends-page",
    name: "Sends",
    description: "Find and sort your sends.",
  },
  {
    id: "projects-page",
    name: "Projects",
    description: "Pick up where you left off.",
  },
  {
    id: "analytics-page",
    name: "Analytics",
    description: "See your climbing progress.",
  },
  {
    id: "account-page",
    name: "Account",
    description: "Choose what you share.",
  },
] as const;

export function TourDestinations({ navigate }: ProductTourStepProps) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <p>
        Explore {TOUR_DEMO_CLIMBER.name}'s sample logbook. Pick a section or start with Journal.
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
      introduction="Start in Journal. Log outdoor sessions and training here to keep your Sends, Projects, and Analytics up to date."
      demo={<DemoJournal />}
    >
      <h3 className="text-lg font-semibold">Find an old entry</h3>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Search</strong> your notes, filter by entry type, or select a tag.
        </li>
        <li>
          <strong>Log each outdoor climb separately.</strong> Edit notes and tags from its menu.
        </li>
      </ul>
    </PageTutorial>
  );
}

function SendsTutorial(props: ProductTourStepProps) {
  return (
    <PageTutorial
      {...props}
      page="Sends"
      href={`/users/${props.userId}/sends`}
      introduction="Your first send of each climb appears here when you log it in Journal. Repeats stay in Journal."
      demo={<DemoSends />}
    >
      <h3 className="text-lg font-semibold">Find a send</h3>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Sort by Date, Grade, or Rating.</strong> Try the buttons in the demo.
        </li>
        <li>
          <strong>On your Sends page,</strong> search and filter climbs. Open one to view or edit
          your send.
        </li>
      </ul>
    </PageTutorial>
  );
}

function ProjectsTutorial(props: ProductTourStepProps) {
  return (
    <PageTutorial
      {...props}
      page="Projects"
      href={`/users/${props.userId}/projects`}
      introduction="Climbs you've logged but haven't sent appear in Projects automatically. This list is private."
      demo={<DemoProjects />}
    >
      <h3 className="text-lg font-semibold">Plan your next session</h3>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Open a project</strong> to read past sessions or log another attempt.
        </li>
        <li>
          <strong>Log “I sent”</strong> to move it to Sends. Past sessions stay in Journal.
        </li>
      </ul>
    </PageTutorial>
  );
}

function AnalyticsTutorial(props: ProductTourStepProps) {
  return (
    <PageTutorial
      {...props}
      page="Analytics"
      href={`/users/${props.userId}/analytics`}
      introduction="Analytics turns your journal entries into climbing stats: days outside, sends, and grade progression."
      demo={<DemoAnalytics />}
    >
      <h3 className="text-lg font-semibold">What the numbers mean</h3>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Dots</strong> show each month's hardest send. The line tracks your personal best.
        </li>
        <li>
          <strong>Days out</strong> count each outdoor date once, with or without a send. Training
          doesn't count.
        </li>
      </ul>
    </PageTutorial>
  );
}

function AccountTutorial(props: ProductTourStepProps) {
  return (
    <PageTutorial
      {...props}
      page="Account"
      href="/account"
      introduction="Choose who sees your climbing history in Account. Your journal starts private."
      demo={<DemoAccount />}
    >
      <h3 className="text-lg font-semibold">Choose what you share</h3>
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Private profile</strong> hides your history. Sends still count toward community
          ratings and grades.
        </li>
        <li>
          <strong>Public journal</strong> shares sessions and training unless your profile is
          private.
        </li>
      </ul>
      <p>
        First-send notes also appear on Sends and follow your profile's privacy settings, even when
        your journal is private.
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
