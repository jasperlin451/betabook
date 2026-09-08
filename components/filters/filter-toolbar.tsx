"use client";

import { buttonVariants, Disclosure } from "@heroui/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";

import { ActiveFilterSummary, type ActiveFilter } from "@/components/filters/active-filter-summary";
import { disciplineActiveFilters } from "@/components/filters/active-filter-values";
import { DisciplineChips } from "@/components/filters/discipline-chips";
import { DisciplineGradeSliders } from "@/components/filters/discipline-grade-sliders";
import { cardClass } from "@/components/ui/card";
import type { DisciplineFilter } from "@/lib/filters/discipline-filter";

const EMPTY_ACTIVE_FILTERS: ActiveFilter[] = [];

/** Narrows an existing list with text, discipline, date, hashtag, and other filters.
 * `textFilter` never renders a separate record-results menu. */
export function FilterToolbar<T extends DisciplineFilter>({
  value,
  onChange,
  onReset,
  textFilter,
  sortControl,
  extraFilters,
  activeFilters = EMPTY_ACTIVE_FILTERS,
}: {
  value: T;
  onChange: (value: T) => void;
  onReset: () => void;
  textFilter?: ReactNode;
  sortControl?: ReactNode;
  /** Rendered in the expanded panel above the grade sliders — the filters
   * that are specific to one list (rating range, ascent style, …). */
  extraFilters?: ReactNode;
  activeFilters?: ActiveFilter[];
}) {
  return (
    <FilterToolbarLayout
      activeFilters={[...disciplineActiveFilters(value, onChange), ...activeFilters]}
      controls={
        <>
          {textFilter}
          <DisciplineChips
            value={value.disciplines}
            onChange={(disciplines) => onChange({ ...value, disciplines })}
          />
        </>
      }
      sortControl={sortControl}
      filters={
        <>
          {extraFilters}
          <DisciplineGradeSliders value={value} onChange={onChange} />
        </>
      }
      onReset={onReset}
    />
  );
}

/** Shared disclosure, panel, and reset action for list filters. */
export function FilterToolbarLayout({
  controls,
  sortControl,
  filters,
  onReset,
  activeFilters = EMPTY_ACTIVE_FILTERS,
}: {
  controls: ReactNode;
  sortControl?: ReactNode;
  filters: ReactNode;
  activeFilters?: ActiveFilter[];
  onReset: () => void;
}) {
  return (
    <Disclosure>
      {({ isExpanded }) => (
        <>
          <div
            role="group"
            aria-label="Filter controls"
            className="flex flex-wrap items-center gap-x-3 gap-y-2"
          >
            {controls}

            <Disclosure.Heading className="contents">
              <Disclosure.Trigger
                className={buttonVariants({
                  variant: "ghost",
                  size: "sm",
                  className: isExpanded ? "bg-surface-tertiary border border-border" : undefined,
                })}
              >
                {isExpanded ? (
                  <ChevronUp className="size-4" aria-hidden />
                ) : (
                  <ChevronDown className="size-4" aria-hidden />
                )}
                {isExpanded ? "Hide filters" : "Expand filters"}
              </Disclosure.Trigger>
            </Disclosure.Heading>
          </div>

          <ActiveFilterSummary filters={activeFilters} onClear={onReset} />

          {/* Disclosure.Body's own p-2 comes from an outer wrapper div this
           * component doesn't expose a className for — style is the only prop
           * that reaches it, so the padding is zeroed there and the panel
           * below owns its own spacing. */}
          <Disclosure.Content className="min-w-0">
            <Disclosure.Body style={{ padding: 0 }}>
              {/* Its own surface, so the expanded filters read as one panel
               * belonging to the bar rather than loose page content. */}
              <section
                aria-label="Filter options"
                className={`mt-3 flex flex-col gap-4 border border-border ${cardClass("sm", "inset")}`}
              >
                {filters}
              </section>
            </Disclosure.Body>
          </Disclosure.Content>
          {sortControl && (
            <div className="mt-4 flex min-w-0 justify-end" role="group" aria-label="Result order">
              {sortControl}
            </div>
          )}
        </>
      )}
    </Disclosure>
  );
}
