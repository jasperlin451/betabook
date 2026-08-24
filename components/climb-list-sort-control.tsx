"use client";

import { Button, ListBox, Select } from "@heroui/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useSortToggle } from "@/hooks/use-sort-toggle";
import type { SubtreeClimbsSort } from "@/db/queries";

type SortField = "name" | "grade" | "rating" | "ascents";

const SORT_FIELDS: SortField[] = ["name", "grade", "rating", "ascents"];

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
 * navigation (each builds its own URL), this owns only the field/direction
 * derivation (via useSortToggle) and the JSX. */
export function ClimbListSortControl({
  sort,
  onNavigate,
}: {
  sort: SubtreeClimbsSort;
  onNavigate: (sort: SubtreeClimbsSort) => void;
}) {
  const { field, direction, handleFieldChange, toggleDirection } = useSortToggle({
    sort,
    fields: SORT_FIELDS,
    defaultField: "ascents",
    defaultDirection: DEFAULT_DIRECTION,
    navigate: onNavigate,
  });

  return (
    <div className="flex items-center gap-2">
      <Select
        aria-label="Sort by"
        selectedKey={field}
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
        aria-label={direction === "asc" ? "Sort ascending" : "Sort descending"}
        onPress={toggleDirection}
      >
        {direction === "asc" ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
      </Button>
    </div>
  );
}
