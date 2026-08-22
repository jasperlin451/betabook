"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, ListBox, Select, TextField } from "@heroui/react";
import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";
import { DisciplineFilterForm } from "@/components/send-filter-form";
import type { Discipline, UserSendsFilter } from "@/db/queries";

const SEARCH_DEBOUNCE_MS = 400;

const MIN_RATING_OPTIONS = ["0", "1", "2", "3", "4", "5"];
const MAX_RATING_OPTIONS = ["Any", "1", "2", "3", "4", "5"];
const DEFAULT_RATING_RANGE: [number, number] = [0, MAX_RATING_OPTIONS.length - 1];

function RatingSelect({
  label,
  options,
  index,
  onChange,
}: {
  label: string;
  options: string[];
  index: number;
  onChange: (index: number) => void;
}) {
  return (
    <Select
      aria-label={label}
      selectedKey={String(index)}
      onSelectionChange={(key) => onChange(Number(key))}
    >
      <Select.Trigger className="w-20">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option, i) => (
            <ListBox.Item key={i} id={String(i)}>
              {option}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function RatingRangeSelect({
  range,
  onChange,
}: {
  range: [number, number];
  onChange: (range: [number, number]) => void;
}) {
  return (
    <div className="flex items-end gap-3">
      <span className="shrink-0 pb-2.5 text-sm font-medium">Rating</span>
      <RatingSelect
        label="Min Rating"
        options={MIN_RATING_OPTIONS}
        index={range[0]}
        onChange={(min) => onChange([min, Math.max(min, range[1])])}
      />
      <span className="pb-2.5 text-muted">–</span>
      <RatingSelect
        label="Max Rating"
        options={MAX_RATING_OPTIONS}
        index={range[1]}
        onChange={(max) => onChange([Math.min(range[0], max), max])}
      />
    </div>
  );
}

export function AreaSearchForm({ defaultName = "" }: { defaultName?: string }) {
  return (
    <form
      method="get"
      className="flex flex-col gap-4 rounded-xl bg-surface-secondary p-6"
    >
      <input type="hidden" name="mode" value="area" />
      <TextField name="name" defaultValue={defaultName}>
        <Label>Area Name</Label>
        <Input placeholder="Wall Boulders, Squamish..." className="bg-surface" />
      </TextField>
      <Button type="submit" fullWidth>
        Search Areas
      </Button>
    </form>
  );
}

const ALL_DISCIPLINES: Discipline[] = ["boulder", "sport", "trad"];

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
  defaultDisciplines = ALL_DISCIPLINES,
  defaultBoulderRange = DEFAULT_BOULDER_RANGE,
  defaultSportRange = DEFAULT_SPORT_RANGE,
  defaultTradRange = DEFAULT_TRAD_RANGE,
}: ClimbSearchFormProps) {
  const router = useRouter();

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
  useEffect(() => {
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

    const timeout = setTimeout(() => {
      router.replace(`/?${params.toString()}`, { scroll: false });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [
    name,
    areaName,
    disciplines,
    showBoulder,
    showSport,
    showTrad,
    boulderRange,
    sportRange,
    tradRange,
    router,
  ]);

  function clearFilters() {
    setName("");
    setAreaName("");
    setRatingRange(DEFAULT_RATING_RANGE);
    setDisciplineFilter({
      disciplines: ALL_DISCIPLINES,
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
