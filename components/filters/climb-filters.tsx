"use client";

import { Button } from "@heroui/react";
import { SlidersHorizontal, X } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";

import { DisciplineChips } from "@/components/filters/discipline-chips";
import { DisciplineGradeSliders } from "@/components/filters/discipline-grade-sliders";
import { cardClass } from "@/components/ui/card";
import { OptionSelect } from "@/components/ui/option-select";
import type { ClimbRefinements } from "@/lib/filters/climb-refinements";
import { DEFAULT_DISCIPLINE_FILTER } from "@/lib/filters/discipline-filter";

export function ClimbFilters({
  value,
  onChange,
  areaControl,
  sortControl,
  ratingControl,
  onReset,
}: {
  value: ClimbRefinements;
  onChange: (value: ClimbRefinements) => void;
  areaControl?: ReactNode;
  sortControl?: ReactNode;
  ratingControl?: ReactNode;
  onReset?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  return (
    <div className="flex flex-col gap-3">
      {areaControl}
      {value.area && (
        <Button
          variant="secondary"
          size="sm"
          className="max-w-full self-start"
          aria-label={`Clear area ${value.area.name}`}
          onPress={() => onChange({ ...value, area: null })}
        >
          <span className="truncate">In area: {value.area.name}</span>
          <X className="size-3.5 shrink-0" aria-hidden />
        </Button>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <DisciplineChips
          value={value.disciplines}
          onChange={(disciplines) => onChange({ ...value, disciplines })}
        />
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          aria-controls={panelId}
          onPress={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters{value.minRating > 0 ? " · 1" : ""}
        </Button>
        {sortControl ?? (
          <OptionSelect
            ariaLabel="Sort results"
            value={value.sort}
            onChange={(sort) => onChange({ ...value, sort })}
            options={[
              { value: "name_asc", label: "Name A–Z" },
              { value: "name_desc", label: "Name Z–A" },
            ]}
            className="w-36 sm:ml-auto"
          />
        )}
      </div>
      {expanded && (
        <div id={panelId} className={`${cardClass("sm")} flex flex-col gap-4`}>
          <DisciplineGradeSliders value={value} onChange={onChange} />
          {ratingControl ?? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">Minimum rating</span>
              <OptionSelect
                ariaLabel="Minimum rating"
                value={String(value.minRating)}
                onChange={(rating) => onChange({ ...value, minRating: Number(rating) })}
                options={[
                  { value: "0", label: "Any rating" },
                  { value: "3", label: "3 stars" },
                  { value: "4", label: "4 stars" },
                ]}
                className="w-36"
              />
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="self-end"
            onPress={
              onReset ??
              (() =>
                onChange({
                  ...DEFAULT_DISCIPLINE_FILTER,
                  area: null,
                  minRating: 0,
                  sort: "name_asc",
                }))
            }
          >
            Reset filters
          </Button>
        </div>
      )}
    </div>
  );
}
