"use client";

import { Button, ListBox, Select } from "@heroui/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useSortToggle } from "@/hooks/use-sort-toggle";

/** The field-dropdown + direction-arrow-button sort control shared by every
 * sortable list (climb search, the area page, the user sends list) — same
 * JSX, differing only in which fields are offered. Owns only the widget;
 * callers own navigation, same as `useSortToggle` underneath it. */
export function SortSelect<Field extends string, Sort extends string>({
  sort,
  fields,
  defaultField,
  defaultDirection,
  onNavigate,
}: {
  sort: Sort;
  fields: readonly { id: Field; label: string }[];
  defaultField: Field;
  defaultDirection: Record<Field, "asc" | "desc">;
  onNavigate: (sort: Sort) => void;
}) {
  const { field, direction, handleFieldChange, toggleDirection } = useSortToggle({
    sort,
    fields: fields.map((f) => f.id),
    defaultField,
    defaultDirection,
    navigate: onNavigate,
  });

  return (
    <div className="flex items-center gap-2">
      {/* Static label so the control reads as "Sort by: X", not a bare
        * value dropdown that could pass for a filter. Dropped on phones,
        * where the row it sits in has no width to spare and the trigger's
        * own value plus the direction arrow already read as a sort; the
        * Select keeps its aria-label, so this is only ever visual. */}
      <span className="hidden shrink-0 text-sm text-muted sm:inline" aria-hidden>
        Sort by
      </span>
      <Select
        aria-label="Sort by"
        selectedKey={field}
        onSelectionChange={(key) => handleFieldChange(key as Field)}
      >
        <Select.Trigger className="w-32">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {fields.map(({ id, label }) => (
              <ListBox.Item key={id} id={id}>
                {label}
              </ListBox.Item>
            ))}
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
