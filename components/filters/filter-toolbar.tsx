"use client";

import { Button, buttonVariants, Disclosure } from "@heroui/react";
import type { ReactNode } from "react";

import { DisciplineChips } from "@/components/filters/discipline-chips";
import { DisciplineGradeSliders } from "@/components/filters/discipline-grade-sliders";
import { cardClass } from "@/components/ui/card";
import type { DisciplineFilter } from "@/lib/filters/discipline-filter";

/** Narrows an existing list with text, discipline, date, hashtag, and other filters.
 * `textFilter` never renders a separate record-results menu. */
export function FilterToolbar<T extends DisciplineFilter>({
  value,
  onChange,
  onReset,
  textFilter,
  sortControl,
  extraFilters,
}: {
  value: T;
  onChange: (value: T) => void;
  onReset: () => void;
  textFilter?: ReactNode;
  sortControl?: ReactNode;
  /** Rendered in the expanded panel above the grade sliders — the filters
   * that are specific to one list (rating range, ascent style, …). */
  extraFilters?: ReactNode;
}) {
  return (
    <FilterToolbarLayout
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
}: {
  controls: ReactNode;
  sortControl?: ReactNode;
  filters: ReactNode;
  onReset: () => void;
}) {
  return (
    <Disclosure>
      {({ isExpanded }) => (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {controls}

            {/* The disclosure and the sort travel together rather than the
             * sort being pushed off alone with ms-auto, which strands it
             * hard right against empty space once the row wraps.
             *
             * Paired at the left until lg, spread apart above it: the
             * filters-left/sort-right convention needs a full line to read
             * as an arrangement — on a phone's wrapped line it is just a
             * gap between two controls that belong together.
             *
             * grow, not flex-1: flex-1 zeroes the basis, so the group would
             * always "fit" whatever sliver is left and get crushed instead
             * of wrapping to its own line. */}
            <div className="flex min-w-0 grow items-center gap-3 lg:justify-between">
              <Disclosure.Heading className="contents">
                <Disclosure.Trigger className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  {isExpanded ? "Fewer filters" : "More filters"}
                </Disclosure.Trigger>
              </Disclosure.Heading>

              {sortControl}
            </div>
          </div>

          {/* Disclosure.Body's own p-2 comes from an outer wrapper div this
           * component doesn't expose a className for — style is the only prop
           * that reaches it, so the padding is zeroed there and the panel
           * below owns its own spacing. */}
          <Disclosure.Content className="min-w-0">
            <Disclosure.Body style={{ padding: 0 }}>
              {/* Its own surface, so the expanded filters read as one panel
               * belonging to the bar rather than loose page content. */}
              <div className={`mt-3 flex flex-col gap-4 ${cardClass("sm")}`}>
                {filters}
                {/* Separated footer so Reset reads as an action on the panel
                 * rather than one more filter in the stack. */}
                <div className="flex justify-end border-t border-separator pt-3">
                  <Button variant="ghost" size="sm" onPress={onReset}>
                    Reset filters
                  </Button>
                </div>
              </div>
            </Disclosure.Body>
          </Disclosure.Content>
        </>
      )}
    </Disclosure>
  );
}
