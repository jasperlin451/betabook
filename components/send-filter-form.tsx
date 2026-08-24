"use client";

import type { ReactNode } from "react";
import { Button, buttonVariants, Checkbox, Disclosure, InputGroup, Label, TextField } from "@heroui/react";
import clsx from "clsx";
import { Search } from "lucide-react";
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

// Shared by climb search and the area page (route/area name search +
// disciplines + grade ranges) and the user sends filter (disciplines + grade
// ranges only, via showNameSearch={false}) — one set of fields, not three
// near-duplicates.

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
      {onNameChange && (
        <TextField value={name} onChange={onNameChange}>
          <Label>Route Name</Label>
          <InputGroup>
            <InputGroup.Prefix>
              <Search className="size-4 text-muted" />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder="Search route name..." />
          </InputGroup>
        </TextField>
      )}
      {onAreaNameChange && (
        <TextField value={areaName} onChange={onAreaNameChange}>
          <Label>Area Name</Label>
          <InputGroup>
            <InputGroup.Prefix>
              <Search className="size-4 text-muted" />
            </InputGroup.Prefix>
            <InputGroup.Input placeholder="Search area..." />
          </InputGroup>
        </TextField>
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

function DisciplineGradeSliders<T extends DisciplineFilter>({
  value,
  onChange,
}: {
  value: T;
  onChange: (value: T) => void;
}) {
  const showBoulder = value.disciplines.includes("boulder");
  const showSport = value.disciplines.includes("sport");
  const showTrad = value.disciplines.includes("trad");

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
  showNameSearch?: boolean;
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
 * search, the area page, and the user sends list render this exact
 * component, differing only in `showNameSearch` and `extraOptions`. Generic
 * over `T` since each caller's filter type carries its own extra fields
 * (rating range/min ascents, ascent styles/min rating, ...) that `onChange`
 * must round-trip through the `{ ...value, disciplines: ... }` spreads in
 * DisciplinesFields/DisciplineGradeSliders below without losing them. */
export function DisciplineFilterForm<T extends DisciplineFilter>({
  value,
  onChange,
  onReset,
  showNameSearch = true,
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
            {showNameSearch && (
              <NameSearchFields
                name={name}
                onNameChange={onNameChange}
                areaName={areaName}
                onAreaNameChange={onAreaNameChange}
              />
            )}

            <DisciplinesFields value={value} onChange={onChange} />

            {!isExpanded && (
              <div className="flex items-center justify-center gap-4">
                <Button variant="ghost" onPress={onReset}>
                  Reset Filters
                </Button>

                <Disclosure.Heading className="contents">
                  <Disclosure.Trigger className={buttonVariants({ variant: "ghost" })}>
                    More Options
                  </Disclosure.Trigger>
                </Disclosure.Heading>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
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

            {isExpanded && (
              <div className="flex items-center justify-center gap-4">
                <Button variant="ghost" onPress={onReset}>
                  Reset Filters
                </Button>

                <Disclosure.Heading className="contents">
                  <Disclosure.Trigger className={buttonVariants({ variant: "ghost" })}>
                    Less Options
                  </Disclosure.Trigger>
                </Disclosure.Heading>
              </div>
            )}
          </div>
        </>
      )}
    </Disclosure>
  );
}

