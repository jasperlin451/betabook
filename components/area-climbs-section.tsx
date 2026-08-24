"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ListBox, Select } from "@heroui/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ClimbList } from "@/components/climb-list";
import { DisciplineFilterForm } from "@/components/send-filter-form";
import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";
import type { SubtreeClimbsSort, UserSendsFilter } from "@/db/queries";

const FILTER_DEBOUNCE_MS = 400;

const DEFAULT_BOULDER_RANGE: [number, number] = [0, BOULDER_HUECO.length - 1];
const DEFAULT_SPORT_RANGE: [number, number] = [0, ROPE_YDS.length - 1];
const DEFAULT_TRAD_RANGE: [number, number] = [0, ROPE_YDS.length - 1];

/** Serializes both the sort and the discipline/grade filter into one query
 * string, shared by the sort control and the filter panel below — each
 * needs to preserve the other's current state when it navigates, or one
 * would silently clear the other. Ranges are only included for checked
 * disciplines, same convention as the climb search page. */
function buildClimbsHref(areaId: number, sort: SubtreeClimbsSort, filter: UserSendsFilter): string {
  const params = new URLSearchParams();
  params.set("sort", sort);
  if (filter.name) params.set("name", filter.name);
  filter.disciplines.forEach((discipline) => params.append("discipline", discipline));
  if (filter.disciplines.includes("boulder")) {
    params.append("boulderRange", String(filter.boulderRange[0]));
    params.append("boulderRange", String(filter.boulderRange[1]));
  }
  if (filter.disciplines.includes("sport")) {
    params.append("sportRange", String(filter.sportRange[0]));
    params.append("sportRange", String(filter.sportRange[1]));
  }
  if (filter.disciplines.includes("trad")) {
    params.append("tradRange", String(filter.tradRange[0]));
    params.append("tradRange", String(filter.tradRange[1]));
  }
  return `/areas/${areaId}?${params.toString()}`;
}

type SortField = "name" | "grade" | "rating" | "ascents";
type SortDirection = "asc" | "desc";

const SORT_FIELDS: SortField[] = ["name", "grade", "rating", "ascents"];

// Alphabetical/hardest/highest-rated/most-sent first by default when a
// field is picked fresh — direction only flips via the separate arrow
// button once a field is already active.
const DEFAULT_DIRECTION: Record<SortField, SortDirection> = {
  name: "asc",
  grade: "desc",
  rating: "desc",
  ascents: "desc",
};

function toSort(field: SortField, direction: SortDirection): SubtreeClimbsSort {
  return `${field}_${direction}` as SubtreeClimbsSort;
}

function fieldOf(sort: SubtreeClimbsSort): SortField {
  return SORT_FIELDS.find((field) => sort.startsWith(field)) ?? "ascents";
}

function directionOf(sort: SubtreeClimbsSort): SortDirection {
  return sort.endsWith("_asc") ? "asc" : "desc";
}

type AreaClimbsSectionProps = {
  areaId: number;
  sort: SubtreeClimbsSort;
  filter: UserSendsFilter;
} & Omit<Parameters<typeof ClimbList>[0], "pagination"> & {
    pagination?: { page: number; hasNextPage: boolean };
  };

/** Owns the climbs sort control (inline with the "Climbs" heading) for the
 * area page — separate from ClimbList itself since ClimbList is also used
 * by climb search, which doesn't have this sort. Same field-dropdown +
 * shared direction-arrow-button UX as the user send list's sort. */
export function AreaClimbsSection({
  areaId,
  sort,
  filter,
  pagination,
  ...climbListProps
}: AreaClimbsSectionProps) {
  const router = useRouter();

  function navigateToSort(nextSort: SubtreeClimbsSort) {
    // Reset to page 1 — the current page number may no longer make sense
    // under a different order. Preserves the active filter (see
    // buildClimbsHref).
    router.replace(buildClimbsHref(areaId, nextSort, filter), { scroll: false });
  }

  function handleFieldChange(field: SortField) {
    // Picking the already-active field keeps its current direction —
    // direction itself is controlled by the separate arrow button, not by
    // reselecting the same dropdown item.
    const direction = fieldOf(sort) === field ? directionOf(sort) : DEFAULT_DIRECTION[field];
    navigateToSort(toSort(field, direction));
  }

  function toggleDirection() {
    navigateToSort(toSort(fieldOf(sort), directionOf(sort) === "asc" ? "desc" : "asc"));
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Climbs</h2>
        <div className="flex items-center gap-2">
          <Select
            aria-label="Sort by"
            selectedKey={fieldOf(sort)}
            onSelectionChange={(key) => handleFieldChange(key as SortField)}
          >
            <Select.Trigger className="w-32">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="name">Name</ListBox.Item>
                <ListBox.Item id="grade">Grade</ListBox.Item>
                <ListBox.Item id="rating">Rating</ListBox.Item>
                <ListBox.Item id="ascents">Ascents</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            aria-label={directionOf(sort) === "asc" ? "Sort ascending" : "Sort descending"}
            onPress={toggleDirection}
          >
            {directionOf(sort) === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </Button>
        </div>
      </div>
      <ClimbList
        {...climbListProps}
        pagination={
          pagination && {
            page: pagination.page,
            hasNextPage: pagination.hasNextPage,
            basePath: buildClimbsHref(areaId, sort, filter),
          }
        }
      />
    </section>
  );
}

/** The name/discipline/grade filter for the area page's climb list — same
 * `DisciplineFilterForm` and debounced-navigation pattern as the climb
 * search page's `ClimbSearchForm` (area search omitted, since this is
 * already scoped to one area) and `UserSendsFilterPanel`. Not keyed on
 * `filter` by the caller, for the same reason documented on
 * `UserSendsFilterPanel` — this component owns the state that drives
 * navigation, so a change is always self-inflicted, never an external
 * resync. */
export function AreaClimbsFilterPanel({
  areaId,
  sort,
  filter,
}: {
  areaId: number;
  sort: SubtreeClimbsSort;
  filter: UserSendsFilter;
}) {
  const router = useRouter();
  const [name, setName] = useState(filter.name ?? "");
  const [disciplineFilter, setDisciplineFilter] = useState<UserSendsFilter>({
    disciplines: filter.disciplines,
    boulderRange: filter.boulderRange,
    sportRange: filter.sportRange,
    tradRange: filter.tradRange,
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace(buildClimbsHref(areaId, sort, { ...disciplineFilter, name }), { scroll: false });
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [areaId, sort, disciplineFilter, name, router]);

  function handleReset() {
    setName("");
    setDisciplineFilter({
      disciplines: [],
      boulderRange: DEFAULT_BOULDER_RANGE,
      sportRange: DEFAULT_SPORT_RANGE,
      tradRange: DEFAULT_TRAD_RANGE,
    });
  }

  return (
    <DisciplineFilterForm
      value={disciplineFilter}
      onChange={setDisciplineFilter}
      onReset={handleReset}
      showNameSearch
      name={name}
      onNameChange={setName}
    />
  );
}
