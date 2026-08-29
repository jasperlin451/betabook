"use client";

import { useState, type ReactNode } from "react";
import { buttonVariants, Button } from "@heroui/react";
import type { Area } from "@/db/queries";
import { AppLink } from "@/components/ui/app-link";
import { ListRow } from "@/components/ui/list-row";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { AreaBreadcrumb } from "@/components/area-breadcrumb";

/** How many sub-area pills the card variant shows before collapsing behind a
 * "Show all N" toggle — a state-level area can have hundreds of sub-areas,
 * which would otherwise wall off everything below the fold. */
const PILL_CAP = 24;

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
    /** Inline error shown above the button when a page fetch failed — the
     * button itself stays as the retry affordance. */
    error?: ReactNode;
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
    return <p className="text-muted text-sm">{emptyMessage}</p>;
  }

  if (variant === "search") {
    const loadMoreBlock = pagination?.hasNextPage && (
      <div className="flex flex-col items-center gap-2">
        {pagination.error}
        <LoadMoreButton onPress={pagination.onLoadMore} loading={pagination.loadingMore} />
      </div>
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col divide-y divide-separator">
          {areas.map((area, index) => (
            <ListRow
              key={area.id}
              leading={
                <span className="w-6 shrink-0 text-sm tabular-nums text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
              }
              title={area.name}
              href={`/areas/${area.id}`}
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
            <AppLink href={`/areas/${area.id}`}>{area.name}</AppLink>
            {area.ancestorPath && (
              <p className="text-muted text-sm">Parent: {area.ancestorPath}</p>
            )}
          </div>
        ))}
      </div>
    );
  }

  const shownAreas = showAllPills ? areas : areas.slice(0, PILL_CAP);

  return (
    <div className="flex flex-wrap gap-2">
      {shownAreas.map((area) => (
        <AppLink
          key={area.id}
          href={`/areas/${area.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          {area.name}
        </AppLink>
      ))}
      {areas.length > PILL_CAP && (
        <Button
          variant="ghost"
          size="sm"
          onPress={() => setShowAllPills((shown) => !shown)}
        >
          {showAllPills ? "Show fewer" : `Show all ${areas.length}`}
        </Button>
      )}
    </div>
  );
}
