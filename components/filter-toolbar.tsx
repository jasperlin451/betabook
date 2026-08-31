"use client";

import type { ReactNode } from "react";
import { Button, buttonVariants, Disclosure } from "@heroui/react";
import { DisciplineGradeSliders } from "@/components/send-filter-form";
import { DisciplineChips } from "@/components/discipline-chips";
import type { DisciplineFilter } from "@/lib/discipline-filter";

/** One toolbar row above a list — search fields, discipline chips, a "More
 * filters" disclosure for the range filters, and the sort control pushed
 * right — instead of a sidebar card spending a whole column on the same
 * fields. Shared by the area page's climb table and a user's send history so
 * filtering feels like one control wherever a list is narrowed.
 *
 * `search` is a slot rather than a prop set because the two differ: the area
 * page scopes route suggestions to its own subtree and has no area field
 * (you're already in one), while sends search both route and area names. */
export function FilterToolbar<T extends DisciplineFilter>({
  value,
  onChange,
  onReset,
  search,
  sortControl,
  extraFilters,
}: {
  value: T;
  onChange: (value: T) => void;
  onReset: () => void;
  search: ReactNode;
  sortControl?: ReactNode;
  /** Rendered in the expanded panel above the grade sliders — the filters
   * that are specific to one list (rating range, ascent style, …). */
  extraFilters?: ReactNode;
}) {
  return (
    <Disclosure>
      {({ isExpanded }) => (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {search}

            <DisciplineChips
              value={value.disciplines}
              onChange={(disciplines) => onChange({ ...value, disciplines })}
            />

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
              <div className="mt-3 flex flex-col gap-4 rounded-xl bg-surface-secondary p-4">
                {extraFilters}
                <DisciplineGradeSliders value={value} onChange={onChange} />
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
