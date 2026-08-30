"use client";

import { SearchField } from "@/components/ui/search-field";
import { useRouter } from "next/navigation";
import { Button, buttonVariants, Disclosure } from "@heroui/react";
import clsx from "clsx";
import { ClimbListSortControl } from "@/components/climb-list-sort-control";
import { ClimbStatsFields } from "@/components/climb-stats-filter-fields";
import { DisciplineGradeSliders } from "@/components/send-filter-form";
import { DISCIPLINE_CHIP_CLASSNAME, DISCIPLINE_LABELS } from "@/components/ui/discipline-chip";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import {
  areaClimbsFilterToSearchParams,
  DEFAULT_AREA_CLIMBS_FILTER,
  DEFAULT_AREA_CLIMBS_SORT,
  type AreaClimbsFilter,
} from "@/lib/area-climbs-filter";
import type { Discipline, SubtreeClimbsSort } from "@/db/queries";

const DISCIPLINES: Discipline[] = ["boulder", "sport", "trad"];

function buildClimbsHref(areaId: number, sort: SubtreeClimbsSort, filter: AreaClimbsFilter): string {
  return `/areas/${areaId}?${areaClimbsFilterToSearchParams(sort, filter).toString()}`;
}

/** One toolbar row above the climb table — search, discipline toggle chips
 * (the same palette chips the rows wear), a "More filters" disclosure for
 * the range filters, and the sort control — replacing the filter sidebar
 * that spent a whole column on three fields. Same debounced URL-navigation
 * machinery as every other filter surface. */
export function AreaClimbsToolbar({
  areaId,
  sort,
  filter,
}: {
  areaId: number;
  sort: SubtreeClimbsSort;
  filter: AreaClimbsFilter;
}) {
  const router = useRouter();
  const { name, setName, filter: value, setFilter: setValue, reset } = useFilterFormNavigation({
    initialFilter: {
      disciplines: filter.disciplines,
      boulderRange: filter.boulderRange,
      sportRange: filter.sportRange,
      tradRange: filter.tradRange,
      ratingRange: filter.ratingRange,
      minAscents: filter.minAscents,
      subareaId: filter.subareaId,
    },
    initialName: filter.name ?? "",
    defaultFilter: DEFAULT_AREA_CLIMBS_FILTER,
    sort,
    defaultSort: DEFAULT_AREA_CLIMBS_SORT,
    buildHref: (value, name, _areaName, effectiveSort = sort) =>
      buildClimbsHref(areaId, effectiveSort, { ...value, name }),
  });

  function toggleDiscipline(discipline: Discipline) {
    const selected = value.disciplines.includes(discipline);
    setValue({
      ...value,
      disciplines: selected
        ? value.disciplines.filter((d) => d !== discipline)
        : [...value.disciplines, discipline],
    });
  }

  return (
    <Disclosure>
      {({ isExpanded }) => (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              value={name}
              onChange={setName}
              ariaLabel="Search route name"
              placeholder="Search routes…"
              className="w-full sm:w-64"
            />

            <div className="flex items-center gap-1.5" role="group" aria-label="Disciplines">
              {DISCIPLINES.map((discipline) => {
                const selected = value.disciplines.includes(discipline);
                return (
                  <button
                    key={discipline}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDiscipline(discipline)}
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

            <Disclosure.Heading className="contents">
              <Disclosure.Trigger className={buttonVariants({ variant: "ghost", size: "sm" })}>
                {isExpanded ? "Fewer filters" : "More filters"}
              </Disclosure.Trigger>
            </Disclosure.Heading>

            <div className="ms-auto">
              <ClimbListSortControl
                sort={sort}
                onNavigate={(nextSort) =>
                  router.replace(buildClimbsHref(areaId, nextSort, filter), { scroll: false })
                }
              />
            </div>
          </div>

          {/* Disclosure.Body's own p-2 comes from an outer wrapper div this
           * component doesn't expose a className for — style is the only
           * prop that reaches it (same workaround as DisciplineFilterForm). */}
          <Disclosure.Content className="min-w-0">
            <Disclosure.Body
              className="flex flex-col gap-6"
              style={{ paddingTop: "1rem", paddingLeft: 0 }}
            >
              <ClimbStatsFields
                ratingRange={value.ratingRange}
                onRatingRangeChange={(ratingRange) => setValue({ ...value, ratingRange })}
                minAscents={value.minAscents}
                onMinAscentsChange={(minAscents) => setValue({ ...value, minAscents })}
              />
              <DisciplineGradeSliders value={value} onChange={setValue} />
              <Button variant="ghost" size="sm" className="self-start" onPress={reset}>
                Reset filters
              </Button>
            </Disclosure.Body>
          </Disclosure.Content>
        </>
      )}
    </Disclosure>
  );
}
