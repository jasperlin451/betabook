"use client";

import {
  Button,
  buttonVariants,
  Checkbox,
  CheckboxGroup,
  Disclosure,
  Fieldset,
  Slider,
} from "@heroui/react";
import { BOULDER_HUECO, ROPE_YDS } from "@/lib/grades";
import { COMPLETION_TYPES, type CompletionType } from "@/lib/sends";
import { DEFAULT_USER_SENDS_FILTER } from "@/lib/user-sends-filter";
import type { Discipline, SendWithUserName, UserSendsFilter } from "@/db/queries";

// Ascent type is the one filter dimension every climb's send list already
// has data for. Richer climb-specific filters (rating threshold, date
// range, etc.) are deferred until that's designed.
export type ClimbSendFilters = {
  ascentTypes: CompletionType[];
};

export const DEFAULT_CLIMB_SEND_FILTERS: ClimbSendFilters = {
  ascentTypes: [...COMPLETION_TYPES],
};

export function filterClimbSends(
  sends: SendWithUserName[],
  filters: ClimbSendFilters,
): SendWithUserName[] {
  return sends.filter((send) => filters.ascentTypes.includes(send.completionType));
}

type SendFilterFormProps =
  | { context: "user"; value: UserSendsFilter; onChange: (value: UserSendsFilter) => void }
  | { context: "climb"; value: ClimbSendFilters; onChange: (value: ClimbSendFilters) => void };

export function SendFilterForm(props: SendFilterFormProps) {
  return (
    <Disclosure className="rounded-xl bg-surface-secondary px-4">
      {({ isExpanded }) => (
        <>
          <Disclosure.Heading className="contents">
            <Disclosure.Trigger
              className={buttonVariants({ variant: "ghost", className: "my-2" })}
            >
              {isExpanded ? "Hide Filters" : "Filters"}
            </Disclosure.Trigger>
          </Disclosure.Heading>

          <Disclosure.Content>
            <Disclosure.Body className="flex flex-col gap-6 pb-4">
              {props.context === "user" ? (
                <UserFilterFields value={props.value} onChange={props.onChange} />
              ) : (
                <ClimbFilterFields value={props.value} onChange={props.onChange} />
              )}
            </Disclosure.Body>
          </Disclosure.Content>
        </>
      )}
    </Disclosure>
  );
}

function UserFilterFields({
  value,
  onChange,
}: {
  value: UserSendsFilter;
  onChange: (value: UserSendsFilter) => void;
}) {
  const showBoulder = value.disciplines.includes("boulder");
  const showSport = value.disciplines.includes("sport");
  const showTrad = value.disciplines.includes("trad");

  return (
    <>
      <Fieldset>
        <Fieldset.Legend>Disciplines</Fieldset.Legend>
        <CheckboxGroup
          aria-label="Disciplines"
          value={value.disciplines}
          onChange={(disciplines) => onChange({ ...value, disciplines: disciplines as Discipline[] })}
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
                value={value.boulderRange}
                onChange={(boulderRange) =>
                  onChange({ ...value, boulderRange: boulderRange as [number, number] })
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
                {BOULDER_HUECO[value.boulderRange[0]]} - {BOULDER_HUECO[value.boulderRange[1]]}
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
                value={value.sportRange}
                onChange={(sportRange) =>
                  onChange({ ...value, sportRange: sportRange as [number, number] })
                }
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
                {ROPE_YDS[value.sportRange[0]]} - {ROPE_YDS[value.sportRange[1]]}
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
                value={value.tradRange}
                onChange={(tradRange) =>
                  onChange({ ...value, tradRange: tradRange as [number, number] })
                }
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
                {ROPE_YDS[value.tradRange[0]]} - {ROPE_YDS[value.tradRange[1]]}
              </span>
            )}
          </div>
        </CheckboxGroup>
      </Fieldset>

      <Button
        variant="ghost"
        className="self-start"
        onPress={() => onChange(DEFAULT_USER_SENDS_FILTER)}
      >
        Reset Filters
      </Button>
    </>
  );
}

function ClimbFilterFields({
  value,
  onChange,
}: {
  value: ClimbSendFilters;
  onChange: (value: ClimbSendFilters) => void;
}) {
  return (
    <>
      <Fieldset>
        <Fieldset.Legend>Ascent type</Fieldset.Legend>
        <CheckboxGroup
          aria-label="Ascent type"
          value={value.ascentTypes}
          onChange={(ascentTypes) =>
            onChange({ ...value, ascentTypes: ascentTypes as CompletionType[] })
          }
          className="flex flex-row gap-4"
        >
          {COMPLETION_TYPES.map((type) => (
            <Checkbox key={type} value={type}>
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className="capitalize">{type}</span>
              </Checkbox.Content>
            </Checkbox>
          ))}
        </CheckboxGroup>
      </Fieldset>

      <Button
        variant="ghost"
        className="self-start"
        onPress={() => onChange(DEFAULT_CLIMB_SEND_FILTERS)}
      >
        Reset Filters
      </Button>
    </>
  );
}
