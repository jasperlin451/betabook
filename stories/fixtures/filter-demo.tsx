import { Button } from "@heroui/react";
import { useEffect, useState } from "react";

import { ClimbFilters } from "@/components/filters/climb-filters";
import { FilterInput } from "@/components/filters/filter-input";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Grade } from "@/components/ui/grade";
import { ListRow } from "@/components/ui/list-row";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { DEFAULT_CLIMB_REFINEMENTS } from "@/lib/filters/climb-refinements";
import { formatGrade } from "@/lib/grades";

import { CATALOG_FIXTURES, SAMPLE_JOURNAL } from "./catalog-data";
import { StoryPage } from "./story-layout";

/** Filters an already supplied list. There is no record lookup, results overlay, or navigation. */
export function LocalFiltersDemo({ list = "area" }: { list?: "area" | "sends" | "journal" }) {
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");
  const [view, setView] = useState("all");
  const [filters, setFilters] = useState(DEFAULT_CLIMB_REFINEMENTS);
  const identity = JSON.stringify([settled, filters, view]);
  const [pagination, setPagination] = useState({ identity, count: 5 });
  const count = pagination.identity === identity ? pagination.count : 5;
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const climbs = CATALOG_FIXTURES.filter((item) => {
    if (item.kind !== "climb") return false;
    if (list === "sends" && !item.sent) return false;
    if (list === "area" && item.areaId !== "area-1" && item.areaId !== "area-11") return false;
    if (!item.name.toLowerCase().includes(settled)) return false;
    if (filters.minRating > (item.rating ?? 0)) return false;
    if (filters.disciplines.length) {
      const [min, max] = filters[`${item.discipline}Range`];
      if (
        !filters.disciplines.includes(item.discipline) ||
        item.grade === null ||
        item.grade < min ||
        item.grade > max
      )
        return false;
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name) * (filters.sort === "name_desc" ? -1 : 1));
  const entries = SAMPLE_JOURNAL.filter(
    (entry) =>
      (view === "all" || entry.kind === view) &&
      `${entry.name} ${entry.detail}`.toLowerCase().includes(settled),
  );
  const title = list === "area" ? "Cedar Grove" : list === "sends" ? "Sends" : "Journal";
  return (
    <StoryPage
      title={title}
      description="Filter the list below without opening a second results menu."
    >
      <FilterInput
        label={list === "area" ? "Filter climbs in Cedar Grove" : `Filter ${list}`}
        value={query}
        onChange={setQuery}
      />
      {list === "journal" ? (
        <>
          <div role="group" aria-label="Entry type" className="flex flex-wrap gap-2">
            {["all", "sessions", "training"].map((item) => (
              <Button
                key={item}
                size="sm"
                variant={view === item ? "secondary" : "ghost"}
                aria-pressed={view === item}
                onPress={() => setView(item)}
              >
                {item === "all" ? "All" : item === "sessions" ? "Sessions" : "Training"}
              </Button>
            ))}
          </div>
          <div
            aria-busy={query.trim().toLowerCase() !== settled}
            className="divide-y divide-separator"
          >
            {entries.map((entry) => (
              <ListRow key={entry.id} title={entry.name} subtitle={entry.detail} />
            ))}
          </div>
          {entries.length === 0 && (
            <EmptyState message="No matching entries. Clear a filter or change the entry type." />
          )}
        </>
      ) : (
        <>
          <ClimbFilters value={filters} onChange={setFilters} />
          <div
            role="region"
            aria-label="Filtered climbs"
            aria-busy={query.trim().toLowerCase() !== settled}
            className="divide-y divide-separator"
          >
            {climbs.slice(0, count).map((item) => (
              <ListRow
                key={item.id}
                title={item.name}
                subtitle={item.detail}
                trailing={
                  item.kind === "climb" && (
                    <div className="flex items-center gap-2">
                      <Grade>{formatGrade(item.discipline, item.grade)}</Grade>
                      <DisciplineChip type={item.discipline} />
                    </div>
                  )
                }
              />
            ))}
          </div>
          {climbs.length === 0 && <EmptyState message="No matching climbs. Clear a filter." />}
          {climbs.length > count && (
            <LoadMoreButton
              onPress={() => setPagination({ identity, count: count + 5 })}
              loading={false}
            />
          )}
        </>
      )}
    </StoryPage>
  );
}
