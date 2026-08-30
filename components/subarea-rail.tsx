"use client";

import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import { AppLink } from "@/components/ui/app-link";
import {
  areaClimbsFilterToSearchParams,
  type AreaClimbsFilter,
} from "@/lib/area-climbs-filter";
import type { SubtreeClimbsSort } from "@/db/queries";

/** The sub-area rail beside the climb table: each row scopes the table to
 * that sub-area's climbs (click again to clear, same toggle convention as
 * the grade histogram), and the trailing arrow visits the sub-area's own
 * page. Sticky with its own scroll on desktop, so a long index never
 * pushes the table away. */
export function SubareaRail({
  areaId,
  sort,
  filter,
  subareas,
}: {
  areaId: number;
  sort: SubtreeClimbsSort;
  filter: AreaClimbsFilter;
  subareas: { id: number; name: string }[];
}) {
  function toggleHref(subareaId: number): string {
    const next: AreaClimbsFilter = {
      ...filter,
      subareaId: filter.subareaId === subareaId ? null : subareaId,
    };
    return `/areas/${areaId}?${areaClimbsFilterToSearchParams(sort, next).toString()}`;
  }

  return (
    <nav
      aria-label="Sub-areas"
      className="lg:sticky lg:top-6 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1"
    >
      <ul className="flex flex-col">
        {subareas.map((subarea) => {
          const selected = filter.subareaId === subarea.id;
          return (
            <li key={subarea.id} className="flex items-center gap-1">
              <AppLink
                href={toggleHref(subarea.id)}
                aria-current={selected ? "true" : undefined}
                aria-label={
                  selected
                    ? `Show climbs from all sub-areas`
                    : `Show only climbs in ${subarea.name}`
                }
                className={clsx(
                  "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-sm no-underline transition-colors",
                  selected
                    ? "bg-surface-secondary font-medium text-foreground"
                    : "text-foreground hover:bg-surface-secondary/60",
                )}
              >
                {subarea.name}
              </AppLink>
              <AppLink
                href={`/areas/${subarea.id}`}
                aria-label={`Open ${subarea.name}`}
                className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:text-foreground"
              >
                <ArrowRight className="size-3.5" aria-hidden />
              </AppLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
