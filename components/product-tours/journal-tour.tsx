"use client";

import { buttonVariants } from "@heroui/react";
import { CirclePlus } from "lucide-react";

import {
  DemoAccount,
  DemoAnalytics,
  DemoJournal,
  DemoProjects,
  DemoSends,
} from "@/components/product-tours/profile-tour-previews";
import type { ProductTourPageProps } from "@/components/product-tours/types";
import { ProfileHeading } from "@/components/profile-heading";
import { ProfileSectionNav } from "@/components/profile-tabs";
import { cardClass } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { SidebarLayout } from "@/components/ui/page-shell";
import { StatStrip } from "@/components/ui/stat-strip";
import { SectionHeading } from "@/components/ui/typography";
import {
  TOUR_DEMO_ANALYTICS,
  TOUR_DEMO_CLIMBER,
  TOUR_DEMO_ENTRIES,
  TOUR_DEMO_SENDS,
} from "@/lib/product-tour-demo";

const SECTIONS = ["Journal", "Sends", "Projects", "Analytics", "Account"];

/** A small read-only example of the Log choices, never a mutation form. */
function DemoLog() {
  return (
    <details data-tour-target="journal-log" className="relative w-fit">
      <summary className={`${buttonVariants()} cursor-pointer list-none gap-2`}>
        <CirclePlus aria-hidden className="size-5" />
        Log
      </summary>
      <div className="mt-2 w-64 rounded-xl border border-border bg-surface p-4 text-sm shadow-lg">
        <p className="mb-3 text-xs text-muted">Example logging choices</p>
        <p className="font-medium">Outdoor session</p>
        <p className="mb-3 text-muted">One climb per entry, including attempts and repeats.</p>
        <p className="font-medium">Training</p>
        <p className="text-muted">Indoor climbing, drills, or strength work.</p>
      </div>
    </details>
  );
}

export function JournalTourPage({ section, href }: ProductTourPageProps) {
  const isJournal = section === "Journal";
  return (
    <div className="flex flex-col gap-6">
      <ProfileHeading name={TOUR_DEMO_CLIMBER.name} since={2026} action={<DemoLog />} />
      <ProfileSectionNav
        tabs={SECTIONS.map((label) => ({
          label,
          href: href(label.toLowerCase()),
          current: section === label,
        }))}
      />
      {isJournal || section === "Sends" ? (
        <SidebarLayout
          sidebar={
            <StatStrip
              cards={[
                {
                  key: "all-time",
                  heading: <Eyebrow>All time</Eyebrow>,
                  stats: isJournal
                    ? [
                        { label: "Days out", value: TOUR_DEMO_ANALYTICS.daysOut },
                        {
                          label: "Sessions",
                          value: TOUR_DEMO_ENTRIES.filter((entry) => entry.kind === "session")
                            .length,
                        },
                        {
                          label: "Training",
                          value: TOUR_DEMO_ENTRIES.filter((entry) => entry.kind === "training")
                            .length,
                        },
                      ]
                    : [
                        { label: "Sends", value: TOUR_DEMO_SENDS.length },
                        { label: "Areas", value: 1 },
                        { label: "Peak grade", value: TOUR_DEMO_ANALYTICS.hardest[0].label },
                      ],
                },
              ]}
            />
          }
        >
          <section aria-label={`Alex's ${section}`} className="flex flex-col gap-3">
            <SectionHeading>{section}</SectionHeading>
            {isJournal ? <DemoJournal /> : <DemoSends />}
          </section>
        </SidebarLayout>
      ) : section === "Projects" ? (
        <section aria-label="Alex's Projects" className="flex flex-col gap-3">
          <SectionHeading>Projects</SectionHeading>
          <DemoProjects />
        </section>
      ) : section === "Analytics" ? (
        <section aria-label="Alex's Analytics" className="max-w-4xl">
          <DemoAnalytics />
        </section>
      ) : (
        <section
          aria-label="Alex's Account"
          className={`${cardClass("md")} flex max-w-xl flex-col gap-4`}
        >
          <SectionHeading>Privacy</SectionHeading>
          <DemoAccount />
        </section>
      )}
    </div>
  );
}
