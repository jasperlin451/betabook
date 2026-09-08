"use client";

import { Button, Checkbox } from "@heroui/react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { ASCENT_STYLE_LABELS } from "@/components/ascent-style";
import { DateFilter } from "@/components/filters/date-filter";
import { FilterInput } from "@/components/filters/filter-input";
import { FilterToolbar } from "@/components/filters/filter-toolbar";
import { HashtagFilter } from "@/components/filters/hashtag-filter";
import { AreaLookup } from "@/components/search/area-lookup";
import { LabeledIndexSelect } from "@/components/ui/index-select";
import { SortSelect } from "@/components/ui/sort-select";
import type { UserSendsFilter } from "@/db/queries";
import { useFilterFormNavigation } from "@/hooks/use-filter-form-navigation";
import { RATING_OPTIONS } from "@/lib/filters/climb-stats-filter";
import {
  DEFAULT_USER_SENDS_FILTER,
  userSendsFilterToSearchParams,
} from "@/lib/filters/user-sends-filter";
import { ASCENT_STYLES, type AscentStyle as AscentStyleType } from "@/lib/sends";

const EMPTY_TAGS: string[] = [];

function AscentStyleFields({
  value,
  onChange,
}: {
  value: AscentStyleType[];
  onChange: (value: AscentStyleType[]) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-start gap-3">
      <span className="text-sm font-medium text-foreground">Ascent style</span>
      <div className="flex flex-wrap items-center justify-start gap-4">
        {ASCENT_STYLES.map((style) => (
          <Checkbox
            key={style}
            isSelected={value.includes(style)}
            onChange={(checked) =>
              onChange(checked ? [...value, style] : value.filter((s) => s !== style))
            }
          >
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              {ASCENT_STYLE_LABELS[style]}
            </Checkbox.Content>
          </Checkbox>
        ))}
      </div>
    </div>
  );
}

function MinRatingSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <LabeledIndexSelect
      label="Min rating"
      options={RATING_OPTIONS}
      index={value}
      onChange={onChange}
    />
  );
}

type SortField = "date" | "grade" | "rating";

const SORT_FIELDS: { id: SortField; label: string }[] = [
  { id: "date", label: "Date" },
  { id: "grade", label: "Grade" },
  { id: "rating", label: "Rating" },
];

const DEFAULT_DIRECTION: Record<SortField, "asc" | "desc"> = {
  date: "desc",
  grade: "desc",
  rating: "desc",
};

/** Do not key the toolbar by filters: remounting loses input focus when a
 * debounced navigation lands. The hook adopts external URL changes in place. */
export function UserSendsFilterToolbar({
  filter,
  basePath,
  tags = EMPTY_TAGS,
  areaFetcher,
}: {
  areaFetcher?: ComponentProps<typeof AreaLookup>["fetcher"];
  tags?: string[];
  filter: UserSendsFilter;
  basePath: string;
}) {
  const router = useRouter();
  const {
    name,
    setName,
    areaName,
    setAreaName,
    filter: disciplineFilter,
    setFilter: setDisciplineFilter,
    reset,
  } = useFilterFormNavigation({
    initialFilter: {
      tags: filter.tags,
      date: filter.date,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
      datePreset: filter.datePreset,
      areaId: filter.areaId,
      disciplines: filter.disciplines,
      boulderRange: filter.boulderRange,
      sportRange: filter.sportRange,
      tradRange: filter.tradRange,
      ascentStyles: filter.ascentStyles,
      minRating: filter.minRating,
    },
    initialName: filter.name ?? "",
    initialAreaName: filter.areaName ?? "",
    defaultFilter: DEFAULT_USER_SENDS_FILTER,
    sort: filter.sort,
    defaultSort: DEFAULT_USER_SENDS_FILTER.sort,
    buildHref: (disciplineFilter, name, areaName, sort) =>
      `${basePath}?${userSendsFilterToSearchParams({ ...disciplineFilter, name, areaName, sort }).toString()}`,
  });

  return (
    <FilterToolbar
      value={disciplineFilter}
      onChange={setDisciplineFilter}
      onReset={reset}
      textFilter={
        <div className="w-full sm:w-64">
          <FilterInput
            value={name}
            onChange={setName}
            label="Filter sends"
            placeholder="Filter sends…"
          />
        </div>
      }
      sortControl={
        <SortSelect
          sort={filter.sort ?? "date_desc"}
          fields={SORT_FIELDS}
          defaultField="date"
          defaultDirection={DEFAULT_DIRECTION}
          onNavigate={(nextSort) => {
            const params = userSendsFilterToSearchParams({ ...filter, sort: nextSort });
            router.replace(`${basePath}?${params.toString()}`, { scroll: false });
          }}
        />
      }
      extraFilters={
        <>
          {disciplineFilter.areaId === undefined && areaName && (
            <Button
              variant="secondary"
              size="sm"
              className="max-w-full self-start"
              aria-label={`Clear area name ${areaName}`}
              onPress={() => setAreaName("")}
            >
              <span className="truncate">Area name: {areaName}</span>
              <X className="size-3.5 shrink-0" aria-hidden />
            </Button>
          )}
          {/* Inline label, matching Ascent Style and Min Rating below. */}
          <div className="grid items-center gap-3 sm:grid-cols-[5rem_16rem]">
            <span className="shrink-0 text-sm font-medium text-foreground">In area</span>
            <div className="w-full sm:w-64">
              <AreaLookup
                fetcher={areaFetcher}
                label="Filter by area"
                value={
                  disciplineFilter.areaId === undefined
                    ? null
                    : {
                        id: String(disciplineFilter.areaId),
                        name: areaName || "Selected area",
                        path: "",
                      }
                }
                onChange={(area) => {
                  setAreaName(area?.name ?? "");
                  setDisciplineFilter({
                    ...disciplineFilter,
                    areaId: area ? Number(area.id) : undefined,
                  });
                }}
              />
            </div>
          </div>
          <HashtagFilter
            inlineLabel
            value={disciplineFilter.tags ?? EMPTY_TAGS}
            tags={tags}
            onChange={(tags) => setDisciplineFilter({ ...disciplineFilter, tags })}
          />
          <DateFilter
            value={disciplineFilter}
            onChange={(dates) => setDisciplineFilter({ ...disciplineFilter, ...dates })}
          />
          <AscentStyleFields
            value={disciplineFilter.ascentStyles}
            onChange={(ascentStyles) => setDisciplineFilter({ ...disciplineFilter, ascentStyles })}
          />
          <MinRatingSelect
            value={disciplineFilter.minRating}
            onChange={(minRating) => setDisciplineFilter({ ...disciplineFilter, minRating })}
          />
        </>
      }
    />
  );
}
