"use client";

import { SortSelect } from "@/components/ui/sort-select";
import type { SubtreeClimbsSort } from "@/db/queries";

export type ClimbListSortField = "name" | "grade" | "rating" | "ascents";

const SORT_FIELDS: { id: ClimbListSortField; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "grade", label: "Grade" },
  { id: "rating", label: "Rating" },
  { id: "ascents", label: "Ascents" },
];

/** The fields a list backed by the public catalog can order on. Rating and
 * ascent count are member aggregates, so offering them would name an ordering
 * the public query refuses. */
export const PUBLIC_CLIMB_SORT_FIELDS: ClimbListSortField[] = ["name", "grade"];

// Alphabetical/hardest/highest-rated/most-sent first by default when a
// field is picked fresh — direction only flips via the separate arrow
// button once a field is already active.
const DEFAULT_DIRECTION: Record<ClimbListSortField, "asc" | "desc"> = {
  name: "asc",
  grade: "desc",
  rating: "desc",
  ascents: "desc",
};

/** The field-dropdown + direction-arrow-button sort control shared by the
 * area page and climb search — both list climbs via the same <ClimbList>
 * and sort on the same name/grade/rating/ascents fields. Callers own
 * navigation (each builds its own URL); this just fixes `SortSelect`'s
 * fields to the ones climb lists sort on. `fields` narrows that set for a list
 * whose query cannot honor all of them. */
export function ClimbListSortControl({
  sort,
  onNavigate,
  fields = SORT_FIELDS.map((field) => field.id),
}: {
  sort: SubtreeClimbsSort;
  onNavigate: (sort: SubtreeClimbsSort) => void;
  fields?: ClimbListSortField[];
}) {
  const offered = SORT_FIELDS.filter((field) => fields.includes(field.id));
  return (
    <SortSelect
      sort={sort}
      fields={offered}
      // Most-sent first stays the default wherever it is offered; a list
      // without it opens on its own first field instead.
      defaultField={fields.includes("ascents") ? "ascents" : offered[0].id}
      defaultDirection={DEFAULT_DIRECTION}
      onNavigate={onNavigate}
    />
  );
}
