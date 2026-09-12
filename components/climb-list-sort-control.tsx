"use client";

import { SortSelect } from "@/components/ui/sort-select";
import type { SubtreeClimbsSort } from "@/db/queries";

type SortField = "name" | "grade" | "rating" | "ascents";

const SORT_FIELDS: { id: SortField; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "grade", label: "Grade" },
  { id: "rating", label: "Rating" },
  { id: "ascents", label: "Ascents" },
];

// Alphabetical/hardest/highest-rated/most-sent first by default when a
// field is picked fresh — direction only flips via the separate arrow
// button once a field is already active.
const DEFAULT_DIRECTION: Record<SortField, "asc" | "desc"> = {
  name: "asc",
  grade: "desc",
  rating: "desc",
  ascents: "desc",
};

/** The field-dropdown + direction-arrow-button sort control shared by the
 * area page and climb search — both list climbs via the same <ClimbList>
 * and sort on the same name/grade/rating/ascents fields. Callers own
 * navigation (each builds its own URL); this just fixes `SortSelect`'s
 * fields to the ones climb lists sort on. */
export function ClimbListSortControl({
  sort,
  onNavigate,
}: {
  sort: SubtreeClimbsSort;
  onNavigate: (sort: SubtreeClimbsSort) => void;
}) {
  return (
    <SortSelect
      sort={sort}
      fields={SORT_FIELDS}
      defaultField="ascents"
      defaultDirection={DEFAULT_DIRECTION}
      onNavigate={onNavigate}
    />
  );
}
