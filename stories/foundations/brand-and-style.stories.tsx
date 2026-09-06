import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Image from "next/image";

import darkLogo from "@/assets/branding/betabook-lockup-dark.png";
import lightLogo from "@/assets/branding/betabook-lockup-light.png";
import { AscentStyle } from "@/components/ascent-style";
import { cardClass } from "@/components/ui/card";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Grade } from "@/components/ui/grade";
import { ListRow } from "@/components/ui/list-row";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTitle, SectionHeading } from "@/components/ui/typography";

import { BrandIconReference } from "./brand-icon-reference";

const meta = { title: "Foundations/Brand and style", component: PageTitle } satisfies Meta<
  typeof PageTitle
>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
export const Foundations: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <PageTitle>Betabook design reference</PageTitle>
      <p className="text-sm text-muted">
        Real application components. Start with docs/design-system.md before changing a shared
        style.
      </p>
      <section className="flex flex-col gap-3">
        <SectionHeading>Brand identity</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Paper treatment", theme: "light", image: lightLogo },
            { label: "Ink treatment", theme: "dark", image: darkLogo },
          ].map(({ label, theme, image }) => (
            <figure key={label} className="flex min-w-0 flex-col gap-2">
              <div data-theme={theme} data-testid={`logo-${theme}`} className="bg-background">
                <Image
                  src={image}
                  alt="Betabook — Climb · Log · Progress. A mountain turning into a checkmark, with a sun."
                  width={1000}
                  height={640}
                  unoptimized
                  className="h-auto w-full"
                />
              </div>
              <figcaption className="text-sm text-muted">{label}</figcaption>
            </figure>
          ))}
        </div>
        <p className="text-sm text-muted">
          A mountain flows into a checkmark beneath a coral sun. Keep the lowercase betabook
          wordmark and CLIMB · LOG · PROGRESS tagline together in the full logo.
        </p>
      </section>
      <BrandIconReference />
      <section className="flex flex-col gap-3">
        <SectionHeading>Surfaces</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <div data-testid="card-small" className={cardClass("sm")}>
            <p className="font-medium">Compact panel</p>
            <p className="text-sm text-muted">Statistics and supporting controls</p>
          </div>
          <div data-testid="card-medium" className={cardClass("md")}>
            <p className="font-medium">Standard panel</p>
            <p className="text-sm text-muted">Forms and settings</p>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeading>Climbing labels</SectionHeading>
        <div className="flex flex-wrap items-center gap-2">
          <DisciplineChip type="boulder" />
          <DisciplineChip type="sport" />
          <DisciplineChip type="trad" />
          <AscentStyle type="onsight" />
          <AscentStyle type="flash" />
          <AscentStyle type="redpoint" />
          <Grade>V4</Grade>
          <Grade>5.11a</Grade>
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeading>Climb rows</SectionHeading>
        <div data-testid="climb-rows" className="divide-y divide-separator">
          <ListRow
            title="Cedar Arete"
            subtitle="North Woods"
            trailing={<Grade>V4</Grade>}
            comment="Found the high foot and linked the moves."
          />
          <ListRow
            title="A very long climb name that still leaves room for the grade"
            subtitle="A long area name near the edge of the valley"
            trailing={<Grade>5.11a</Grade>}
          />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <SectionHeading>Empty and loading</SectionHeading>
        <EmptyState message="No sends yet." />
        <div role="status" aria-label="Loading climbs" className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </section>
    </div>
  ),
};
