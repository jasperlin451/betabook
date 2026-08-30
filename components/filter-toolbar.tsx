"use client";

import type { ReactNode } from "react";
import { Button, buttonVariants, Disclosure } from "@heroui/react";
import clsx from "clsx";
import { DisciplineGradeSliders } from "@/components/send-filter-form";
import { DISCIPLINE_CHIP_CLASSNAME, DISCIPLINE_LABELS } from "@/components/ui/discipline-chip";
import type { Discipline } from "@/db/queries";
import type { DisciplineFilter } from "@/lib/discipline-filter";

const DISCIPLINES: Discipline[] = ["boulder", "sport", "trad"];

/** Discipline toggles as the same palette chips the rows themselves wear —
 * three taps instead of a labelled checkbox group, which is what lets the
 * whole filter fit on one line. */
function DisciplineChips<T extends DisciplineFilter>({
  value,
  onChange,
}: {
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Disciplines">
      {DISCIPLINES.map((discipline) => {
        const selected = value.disciplines.includes(discipline);
        return (
          <button
            key={discipline}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onChange({
                ...value,
                disciplines: selected
                  ? value.disciplines.filter((d) => d !== discipline)
                  : [...value.disciplines, discipline],
              })
            }
            className={clsx(
              "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
              selected
                ? `border-transparent font-medium ${DISCIPLINE_CHIP_CLASSNAME[discipline]}`
                : "border-border text-muted hover:text-foreground",
            )}
          >
            {DISCIPLINE_LABELS[discipline]}
          </button>
        );
      })}
    </div>
  );
}

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
          {/* One flat wrapping row, so the filters stay in reading order and
            * only the sort is pushed to the end. When the column is too
            * narrow for all of it (the sends page, whose stats sidebar takes
            * a third of the width), the sort drops to its own line still
            * right-aligned rather than breaking up the filter group. */}
          <div className="flex flex-wrap items-center gap-2">
            {search}

            <DisciplineChips value={value} onChange={onChange} />

            <Disclosure.Heading className="contents">
              <Disclosure.Trigger className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {isExpanded ? "Fewer filters" : "More filters"}
              </Disclosure.Trigger>
            </Disclosure.Heading>

            {sortControl && <div className="ms-auto">{sortControl}</div>}
          </div>

          {/* Disclosure.Body's own p-2 comes from an outer wrapper div this
           * component doesn't expose a className for — style is the only prop
           * that reaches it, so the padding is zeroed there and the panel
           * below owns its own spacing. */}
          <Disclosure.Content className="min-w-0">
            <Disclosure.Body style={{ padding: 0 }}>
              {/* A surface, not loose fields on the page background: the
                * expanded filters are one panel hanging off the bar, and
                * without a ground they read as stray page content. */}
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
