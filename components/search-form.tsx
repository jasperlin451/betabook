"use client";

import { useState } from "react";
import { Input, Label, TextField } from "@heroui/react";
import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";
import { DisciplineFilterForm } from "@/components/send-filter-form";
import { IndexRangeSelect } from "@/components/ui/index-select";
import { useDebouncedReplace } from "@/hooks/use-debounced-replace";
import type { Discipline, UserSendsFilter } from "@/db/queries";

const MIN_RATING_OPTIONS = ["0", "1", "2", "3", "4", "5"];
const MAX_RATING_OPTIONS = ["Any", "1", "2", "3", "4", "5"];
const DEFAULT_RATING_RANGE: [number, number] = [0, MAX_RATING_OPTIONS.length - 1];

function RatingRangeSelect({
  range,
  onChange,
}: {
  range: [number, number];
  onChange: (range: [number, number]) => void;
}) {
  return (
    <IndexRangeSelect
      label="Rating"
      minOptions={MIN_RATING_OPTIONS}
      maxOptions={MAX_RATING_OPTIONS}
      minLabel="Min Rating"
      maxLabel="Max Rating"
      range={range}
      onChange={onChange}
    />
  );
}

export function AreaSearchForm({ defaultName = "" }: { defaultName?: string }) {
  const [name, setName] = useState(defaultName);

  // Auto-search: debounce every field change (including the initial render)
  // into a single navigation, same as the climb search form.
  const params = new URLSearchParams();
  params.set("mode", "area");
  if (name) params.set("name", name);
  useDebouncedReplace(`/?${params.toString()}`);

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-surface-secondary p-6">
      <TextField value={name} onChange={setName}>
        <Label>Area Name</Label>
        <Input placeholder="Search area..." className="bg-surface" />
      </TextField>
    </div>
  );
}

const DEFAULT_BOULDER_RANGE: [number, number] = [0, BOULDER_HUECO.length - 1];
const DEFAULT_SPORT_RANGE: [number, number] = [0, ROPE_YDS.length - 1];
const DEFAULT_TRAD_RANGE: [number, number] = [0, ROPE_YDS.length - 1];

type ClimbSearchFormProps = {
  defaultName?: string;
  defaultAreaName?: string;
  defaultDisciplines?: Discipline[];
  defaultBoulderRange?: [number, number];
  defaultSportRange?: [number, number];
  defaultTradRange?: [number, number];
};

export function ClimbSearchForm({
  defaultName = "",
  defaultAreaName = "",
  defaultDisciplines = [],
  defaultBoulderRange = DEFAULT_BOULDER_RANGE,
  defaultSportRange = DEFAULT_SPORT_RANGE,
  defaultTradRange = DEFAULT_TRAD_RANGE,
}: ClimbSearchFormProps) {
  const [name, setName] = useState(defaultName);
  const [areaName, setAreaName] = useState(defaultAreaName);
  // Rating isn't backed by real data yet — it's a UI placeholder for now and
  // doesn't factor into the search.
  const [ratingRange, setRatingRange] = useState<[number, number]>(DEFAULT_RATING_RANGE);
  const [disciplineFilter, setDisciplineFilter] = useState<UserSendsFilter>({
    disciplines: defaultDisciplines,
    boulderRange: defaultBoulderRange,
    sportRange: defaultSportRange,
    tradRange: defaultTradRange,
  });

  const { disciplines, boulderRange, sportRange, tradRange } = disciplineFilter;
  const showBoulder = disciplines.includes("boulder");
  const showSport = disciplines.includes("sport");
  const showTrad = disciplines.includes("trad");

  // Auto-search: debounce every field change (including the initial render)
  // into a single navigation instead of requiring an explicit submit.
  const params = new URLSearchParams();
  params.set("mode", "climb");
  if (name) params.set("name", name);
  if (areaName) params.set("areaName", areaName);
  disciplines.forEach((d) => params.append("discipline", d));
  if (showBoulder) {
    params.append("boulderRange", String(boulderRange[0]));
    params.append("boulderRange", String(boulderRange[1]));
  }
  if (showSport) {
    params.append("sportRange", String(sportRange[0]));
    params.append("sportRange", String(sportRange[1]));
  }
  if (showTrad) {
    params.append("tradRange", String(tradRange[0]));
    params.append("tradRange", String(tradRange[1]));
  }
  useDebouncedReplace(`/?${params.toString()}`);

  function clearFilters() {
    setName("");
    setAreaName("");
    setRatingRange(DEFAULT_RATING_RANGE);
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
      onReset={clearFilters}
      name={name}
      onNameChange={setName}
      areaName={areaName}
      onAreaNameChange={setAreaName}
      extraOptions={<RatingRangeSelect range={ratingRange} onChange={setRatingRange} />}
    />
  );
}
