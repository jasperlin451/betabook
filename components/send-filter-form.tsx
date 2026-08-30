"use client";

import { RouteSearchField } from "@/components/route-search-field";
import { AreaSearchField } from "@/components/area-search-field";
import type { ReactNode } from "react";
import { Button, buttonVariants, Checkbox, Disclosure } from "@heroui/react";
import clsx from "clsx";
import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";
import { IndexRangeSelect } from "@/components/ui/index-select";
import type { Discipline } from "@/db/queries";
import type { DisciplineFilter } from "@/lib/discipline-filter";

function toggleDiscipline(
  disciplines: Discipline[],
  value: Discipline,
  checked: boolean,
): Discipline[] {
  return checked ? [...disciplines, value] : disciplines.filter((d) => d !== value);
}

// Shared by climb search and the user sends list — one set of fields, not
// two near-duplicates. Each name field renders only when its handler is
// passed, so a caller opts in per field rather than all-or-nothing.

type NameSearchFieldsProps = {
  name?: string;
  onNameChange?: (value: string) => void;
  areaName?: string;
  onAreaNameChange?: (value: string) => void;
};

function NameSearchFields({
  name = "",
  onNameChange,
  areaName = "",
  onAreaNameChange,
}: NameSearchFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Both are filters: the list below is what answers the search, so
        * picking a suggestion completes the field's text (getting the exact
        * spelling) rather than navigating away from the results. */}
      {onNameChange && (
        <RouteSearchField
          value={name}
          onChange={onNameChange}
          onSelect={(route) => onNameChange(route.name)}
          label="Route Name"
        />
      )}
      {onAreaNameChange && (
        // "In area" reads as a constraint on the route search ("routes named
        // X, in area Y"), not a second area search; "Anywhere" states the
        // default scope instead of echoing "search".
        <AreaSearchField
          value={areaName}
          onChange={onAreaNameChange}
          onSelect={(area) => onAreaNameChange(area.name)}
          label="In area"
          placeholder="Anywhere"
          inputClassName="bg-surface"
          fullWidth
        />
      )}
      {(onNameChange || onAreaNameChange) && (
        <p className="text-xs text-muted">Results update as you type.</p>
      )}
    </div>
  );
}

function DisciplinesFields<T extends DisciplineFilter>({
  value,
  onChange,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const showBoulder = value.disciplines.includes("boulder");
  const showSport = value.disciplines.includes("sport");
  const showTrad = value.disciplines.includes("trad");

  return (
    <div className={clsx("flex flex-wrap items-center justify-start gap-3", className)}>
      <span className="text-sm font-medium text-foreground">Disciplines</span>
      <div className="flex flex-wrap items-center justify-start gap-4">
        <Checkbox
          isSelected={showBoulder}
          onChange={(checked) =>
            onChange({ ...value, disciplines: toggleDiscipline(value.disciplines, "boulder", checked) })
          }
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Boulder
          </Checkbox.Content>
        </Checkbox>
        <Checkbox
          isSelected={showSport}
          onChange={(checked) =>
            onChange({ ...value, disciplines: toggleDiscipline(value.disciplines, "sport", checked) })
          }
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Sport
          </Checkbox.Content>
        </Checkbox>
        <Checkbox
          isSelected={showTrad}
          onChange={(checked) =>
            onChange({ ...value, disciplines: toggleDiscipline(value.disciplines, "trad", checked) })
          }
        >
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Trad
          </Checkbox.Content>
        </Checkbox>
      </div>
    </div>
  );
}

export function DisciplineGradeSliders<T extends DisciplineFilter>({
  value,
  onChange,
}: {
  value: T;
  onChange: (value: T) => void;
}) {
  const showBoulder = value.disciplines.includes("boulder");
  const showSport = value.disciplines.includes("sport");
  const showTrad = value.disciplines.includes("trad");

  // Nothing selected means no grade scale applies. Returning null rather
  // than an empty flex container matters in the toolbar's expanded panel,
  // where an empty child still claims a gap and opens a visible hole above
  // the footer.
  if (!showBoulder && !showSport && !showTrad) return null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-6">
      {showBoulder && (
        <IndexRangeSelect
          label="Boulder"
          minOptions={BOULDER_HUECO}
          maxOptions={BOULDER_HUECO}
          minLabel="Min Grade"
          maxLabel="Max Grade"
          range={value.boulderRange}
          onChange={(boulderRange) => onChange({ ...value, boulderRange })}
        />
      )}

      {showSport && (
        <IndexRangeSelect
          label="Sport"
          minOptions={ROPE_YDS}
          maxOptions={ROPE_YDS}
          minLabel="Min Grade"
          maxLabel="Max Grade"
          range={value.sportRange}
          onChange={(sportRange) => onChange({ ...value, sportRange })}
        />
      )}

      {showTrad && (
        <IndexRangeSelect
          label="Trad"
          minOptions={ROPE_YDS}
          maxOptions={ROPE_YDS}
          minLabel="Min Grade"
          maxLabel="Max Grade"
          range={value.tradRange}
          onChange={(tradRange) => onChange({ ...value, tradRange })}
        />
      )}
    </div>
  );
}

export type DisciplineFilterFormProps<T extends DisciplineFilter> = {
  value: T;
  onChange: (value: T) => void;
  onReset: () => void;
  name?: string;
  onNameChange?: (value: string) => void;
  areaName?: string;
  onAreaNameChange?: (value: string) => void;
  /** Extra fields rendered inside "More Options", above the grade sliders —
   * e.g. the rating-range/min-ascents fields shared by climb search and the
   * area page. Not part of `value` since it isn't a discipline/grade filter. */
  extraOptions?: ReactNode;
};

/** The one filter form for discipline + grade-range filtering — climb
 * search and the user sends list render this exact component, differing only
 * in which name handlers they pass and in `extraOptions`. (The area page
 * renders the same fields through its own toolbar layout instead, since a
 * crag page puts them in a row rather than a sidebar card.) Generic
 * over `T` since each caller's filter type carries its own extra fields
 * (rating range/min ascents, ascent styles/min rating, ...) that `onChange`
 * must round-trip through the `{ ...value, disciplines: ... }` spreads in
 * DisciplinesFields/DisciplineGradeSliders below without losing them. */
export function DisciplineFilterForm<T extends DisciplineFilter>({
  value,
  onChange,
  onReset,
  name,
  onNameChange,
  areaName,
  onAreaNameChange,
  extraOptions,
}: DisciplineFilterFormProps<T>) {
  return (
    <Disclosure className="rounded-xl bg-surface-secondary p-6">
      {({ isExpanded }) => (
        <>
          <div className="flex flex-col gap-4">
            <NameSearchFields
              name={name}
              onNameChange={onNameChange}
              areaName={areaName}
              onAreaNameChange={onAreaNameChange}
            />

            <DisciplinesFields value={value} onChange={onChange} />
          </div>

          {/* Disclosure.Body's own p-2 comes from an outer wrapper div this
           * component doesn't expose a className for — style is the only
           * prop that reaches it, to align this with the visible row above
           * (pt-4 matches that row's own gap-4; pl-0 removes the built-in
           * left inset so content lines up with the card's own padding). */}
          <Disclosure.Content className="min-w-0">
            <Disclosure.Body
              className="flex flex-col gap-6"
              style={{ paddingTop: "1rem", paddingLeft: 0 }}
            >
              {extraOptions}
              <DisciplineGradeSliders value={value} onChange={onChange} />
            </Disclosure.Body>
          </Disclosure.Content>

          {/* One action row for both states, always after the panel — the
           * trigger is the same element across toggles (so keyboard focus
           * survives; the collapsed panel contributes no height, so the row
           * sits in the same visual spot as it did inside the top group). */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <Button variant="ghost" onPress={onReset}>
              Reset Filters
            </Button>

            <Disclosure.Heading className="contents">
              <Disclosure.Trigger className={buttonVariants({ variant: "ghost" })}>
                {isExpanded ? "Less Options" : "More Options"}
              </Disclosure.Trigger>
            </Disclosure.Heading>
          </div>
        </>
      )}
    </Disclosure>
  );
}

