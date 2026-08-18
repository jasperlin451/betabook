"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  buttonVariants,
  Checkbox,
  CheckboxGroup,
  Disclosure,
  Fieldset,
  Input,
  InputGroup,
  Label,
  Slider,
  TextField,
} from "@heroui/react";
import { Search } from "lucide-react";
import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";

const SEARCH_DEBOUNCE_MS = 400;

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

const ALL_DISCIPLINES = ["boulder", "sport", "trad"];

const DEFAULT_BOULDER_RANGE: [number, number] = [0, BOULDER_HUECO.length - 1];
const DEFAULT_SPORT_RANGE: [number, number] = [0, ROPE_YDS.length - 1];
const DEFAULT_TRAD_RANGE: [number, number] = [0, ROPE_YDS.length - 1];

type ClimbSearchFormProps = {
  defaultName?: string;
  defaultAreaName?: string;
  defaultDisciplines?: string[];
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
  const [rating, setRating] = useState(0);
  const [disciplines, setDisciplines] = useState<string[]>(defaultDisciplines);
  const [boulderRange, setBoulderRange] =
    useState<[number, number]>(defaultBoulderRange);
  const [sportRange, setSportRange] = useState<[number, number]>(defaultSportRange);
  const [tradRange, setTradRange] = useState<[number, number]>(defaultTradRange);

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
    setRating(0);
    setDisciplines(ALL_DISCIPLINES);
    setBoulderRange(DEFAULT_BOULDER_RANGE);
    setSportRange(DEFAULT_SPORT_RANGE);
    setTradRange(DEFAULT_TRAD_RANGE);
  }

  return (
    <Disclosure className="rounded-xl bg-surface-secondary p-6">
      {({ isExpanded }) => (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <TextField value={name} onChange={setName} className="min-w-56 flex-1">
              <Label>Route Name</Label>
              <InputGroup>
                <InputGroup.Prefix>
                  <Search className="size-4 text-muted" />
                </InputGroup.Prefix>
                <InputGroup.Input placeholder="Search route name..." />
              </InputGroup>
            </TextField>

            <TextField
              value={areaName}
              onChange={setAreaName}
              className="min-w-56 flex-1"
            >
              <Label>Area Name</Label>
              <InputGroup>
                <InputGroup.Prefix>
                  <Search className="size-4 text-muted" />
                </InputGroup.Prefix>
                <InputGroup.Input placeholder="Search area..." />
              </InputGroup>
            </TextField>

            <div className="flex w-40 flex-col gap-2">
              <Label>Rating ({rating === 0 ? "any" : `${rating}+`})</Label>
              <Slider
                value={rating}
                onChange={(value) => setRating(value as number)}
                minValue={0}
                maxValue={5}
                step={1}
              >
                <Slider.Track>
                  <Slider.Fill />
                  <Slider.Thumb />
                </Slider.Track>
              </Slider>
            </div>

            <Button variant="ghost" onPress={clearFilters}>
              Reset Filters
            </Button>

            <Disclosure.Heading className="contents">
              <Disclosure.Trigger className={buttonVariants({ variant: "ghost" })}>
                {isExpanded ? "Hide Filters" : "More Options"}
              </Disclosure.Trigger>
            </Disclosure.Heading>
          </div>

          <Disclosure.Content>
            <Disclosure.Body className="flex flex-col gap-6">
              <Fieldset>
                <Fieldset.Legend>Disciplines</Fieldset.Legend>
                <CheckboxGroup
                  value={disciplines}
                  onChange={setDisciplines}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center gap-4">
                    <Checkbox value="boulder" className="w-24 shrink-0">
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        Boulder
                      </Checkbox.Content>
                    </Checkbox>
                    {showBoulder && (
                      <Slider
                        aria-label="Boulder grade range"
                        value={boulderRange}
                        onChange={(value) =>
                          setBoulderRange(value as [number, number])
                        }
                        minValue={0}
                        maxValue={BOULDER_HUECO.length - 1}
                        step={1}
                        className="flex-1"
                      >
                        <Slider.Track>
                          <Slider.Fill />
                          <Slider.Thumb index={0} />
                          <Slider.Thumb index={1} />
                        </Slider.Track>
                      </Slider>
                    )}
                    {showBoulder && (
                      <span className="w-20 shrink-0 text-right text-xs text-muted">
                        {BOULDER_HUECO[boulderRange[0]]} - {BOULDER_HUECO[boulderRange[1]]}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <Checkbox value="sport" className="w-24 shrink-0">
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        Sport
                      </Checkbox.Content>
                    </Checkbox>
                    {showSport && (
                      <Slider
                        aria-label="Sport grade range"
                        value={sportRange}
                        onChange={(value) => setSportRange(value as [number, number])}
                        minValue={0}
                        maxValue={ROPE_YDS.length - 1}
                        step={1}
                        className="flex-1"
                      >
                        <Slider.Track>
                          <Slider.Fill />
                          <Slider.Thumb index={0} />
                          <Slider.Thumb index={1} />
                        </Slider.Track>
                      </Slider>
                    )}
                    {showSport && (
                      <span className="w-20 shrink-0 text-right text-xs text-muted">
                        {ROPE_YDS[sportRange[0]]} - {ROPE_YDS[sportRange[1]]}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <Checkbox value="trad" className="w-24 shrink-0">
                      <Checkbox.Content>
                        <Checkbox.Control>
                          <Checkbox.Indicator />
                        </Checkbox.Control>
                        Trad
                      </Checkbox.Content>
                    </Checkbox>
                    {showTrad && (
                      <Slider
                        aria-label="Trad grade range"
                        value={tradRange}
                        onChange={(value) => setTradRange(value as [number, number])}
                        minValue={0}
                        maxValue={ROPE_YDS.length - 1}
                        step={1}
                        className="flex-1"
                      >
                        <Slider.Track>
                          <Slider.Fill />
                          <Slider.Thumb index={0} />
                          <Slider.Thumb index={1} />
                        </Slider.Track>
                      </Slider>
                    )}
                    {showTrad && (
                      <span className="w-20 shrink-0 text-right text-xs text-muted">
                        {ROPE_YDS[tradRange[0]]} - {ROPE_YDS[tradRange[1]]}
                      </span>
                    )}
                  </div>
                </CheckboxGroup>
              </Fieldset>
            </Disclosure.Body>
          </Disclosure.Content>
        </>
      )}
    </Disclosure>
  );
}
