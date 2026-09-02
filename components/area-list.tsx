"use client";

import { buttonVariants, Button } from "@heroui/react";
import { useState } from "react";

import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { AppLink } from "@/components/ui/app-link";
import { EmptyState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list-row";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import type { Area } from "@/db/queries";
import { areaHref } from "@/lib/slug";

/** How many sub-area pills the card variant shows before collapsing behind a
 * "Show all N" toggle — a state-level area can have hundreds of sub-areas,
 * which would otherwise wall off everything below the fold. */
const PILL_CAP = 24;

/** Above this many sub-areas, pills give way to the columned index. */
const PILL_LAYOUT_MAX = 10;

type AreaListProps = {
  areas: (Area & { ancestorPath?: string | null })[];
  emptyMessage?: string;
  variant?: "card" | "link" | "search";
  /** Up to two nearest ancestors per area, keyed by area id — only
   * meaningful for `variant="search"`. */
  areaBreadcrumbs?: Record<number, { id: number; name: string }[]>;
  /** A "load more" button shown at the bottom of the list, in place of
   * numbered pagination — same pattern as ClimbList. Only meaningful for
   * `variant="search"`. */
  pagination?: {
    hasNextPage: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
    /** The last page fetch failed — LoadMoreButton says so and stays as the
     * retry affordance. */
    failed?: boolean;
  };
};

export function AreaList({
  areas,
  emptyMessage = "No areas found.",
  variant = "card",
  areaBreadcrumbs,
  pagination,
}: AreaListProps) {
  // Unconditional (React hooks rule) even though only the card variant uses it.
  const [showAllPills, setShowAllPills] = useState(false);

  if (areas.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  if (variant === "search") {
    const loadMoreBlock = pagination?.hasNextPage && (
      <LoadMoreButton
        onPress={pagination.onLoadMore}
        loading={pagination.loadingMore}
        failed={pagination.failed}
      />
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col divide-y divide-separator">
          {areas.map((area, index) => (
            <ListRow
              key={area.id}
              leading={
                <span className="w-6 shrink-0 text-sm text-muted tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
              }
              title={area.name}
              href={areaHref(area.id, area.name)}
              subtitle={<AreaBreadcrumb ancestors={areaBreadcrumbs?.[area.id] ?? []} />}
            />
          ))}
        </div>
        {loadMoreBlock}
      </div>
    );
  }

  if (variant === "link") {
    return (
      <div className="flex flex-col gap-3">
        {areas.map((area) => (
          <div key={area.id}>
            <AppLink href={areaHref(area.id, area.name)}>{area.name}</AppLink>
            {area.ancestorPath && <p className="text-sm text-muted">Parent: {area.ancestorPath}</p>}
          </div>
        ))}
      </div>
    );
  }

  // A handful of sub-areas read fine as pills; past that a pill wall turns
  // into visual porridge, so larger sets switch to an alphabetized
  // multi-column index — the way a guidebook lists a region's crags.
  if (areas.length > PILL_LAYOUT_MAX) {
    const sorted = [...areas].sort((a, b) => a.name.localeCompare(b.name));
    const shownAreas = showAllPills ? sorted : sorted.slice(0, PILL_CAP);
    return (
      <div className="flex flex-col gap-3">
        <ul className="columns-2 gap-x-8 sm:columns-3 lg:columns-4">
          {shownAreas.map((area) => (
            <li key={area.id} className="mb-1.5 break-inside-avoid text-sm">
              <AppLink href={areaHref(area.id, area.name)}>{area.name}</AppLink>
            </li>
          ))}
        </ul>
        {areas.length > PILL_CAP && (
          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onPress={() => setShowAllPills((shown) => !shown)}
          >
            {showAllPills ? "Show fewer" : `Show all ${areas.length}`}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {areas.map((area) => (
        <AppLink
          key={area.id}
          href={areaHref(area.id, area.name)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {area.name}
        </AppLink>
      ))}
    </div>
  );
}
