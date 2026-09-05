"use client";

import { Button, Checkbox, SearchField } from "@heroui/react";
import { useState } from "react";

import { StatTiles } from "@/components/analytics-stat-tiles";
import { ProgressionChart } from "@/components/progression-chart";
import { choicePillClass } from "@/components/ui/choice-pill";
import { ListRow } from "@/components/ui/list-row";
import { nativeGradeArray } from "@/lib/grades";
import {
  TOUR_DEMO_ANALYTICS,
  TOUR_DEMO_CLIMBER,
  TOUR_DEMO_ENTRIES,
  TOUR_DEMO_PROJECT,
  TOUR_DEMO_SENDS,
} from "@/lib/product-tour-demo";

function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          className={choicePillClass(value === option, "bg-foreground text-background")}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function DemoJournal() {
  const [view, setView] = useState<"All" | "Sessions" | "Training">("All");
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState(false);
  const entries = TOUR_DEMO_ENTRIES.filter(
    (entry) =>
      (view === "All" || entry.kind === (view === "Sessions" ? "session" : "training")) &&
      (!tag || entry.tags.includes("footwork")) &&
      entry.note.toLowerCase().includes(query.toLowerCase().trim()),
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Try Training, search for “feet”, or select the footwork tag.
      </p>
      <SearchField aria-label="Search Alex's journal" value={query} onChange={setQuery}>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Search journal…" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
      <Choices
        label="Journal entry type"
        options={["All", "Sessions", "Training"]}
        value={view}
        onChange={setView}
      />
      <button
        type="button"
        aria-pressed={tag}
        onClick={() => setTag(!tag)}
        className={`${choicePillClass(tag, "bg-foreground text-background")} self-start`}
      >
        #footwork
      </button>
      <p role="status" className="text-xs text-muted">
        {entries.length} of {TOUR_DEMO_ENTRIES.length} entries
      </p>
      <div className="divide-y divide-border">
        {entries.map((entry) => (
          <ListRow
            key={entry.id}
            title={entry.climb?.name ?? "Training"}
            subtitle={`${entry.date} · ${entry.outcome}`}
            meta={entry.climb?.grade}
            comment={entry.note}
          />
        ))}
      </div>
      {entries.length === 0 && (
        <p className="text-sm">
          No matching entries. Clear the search or turn off a filter to see more.
        </p>
      )}
    </div>
  );
}

export function DemoSends() {
  const [sort, setSort] = useState<"Date" | "Grade" | "Rating">("Date");
  const sends = [...TOUR_DEMO_SENDS].sort((a, b) => {
    if (sort === "Grade") return b.suggestedGrade - a.suggestedGrade;
    if (sort === "Rating") return b.rating - a.rating;
    return b.dateSent.localeCompare(a.dateSent);
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Sort Alex's three ascents. Quiet Arete's repeat stays in Journal.
      </p>
      <Choices
        label="Sort sends"
        options={["Date", "Grade", "Rating"]}
        value={sort}
        onChange={setSort}
      />
      <p role="status" className="text-xs text-muted">
        {sort === "Date"
          ? "Newest first"
          : `${sort === "Grade" ? "Hardest" : "Highest rated"} first`}
      </p>
      <div className="divide-y divide-border">
        {sends.map((send) => (
          <ListRow
            key={send.climbId}
            title={send.climbName}
            subtitle={`${send.dateSent} · ${send.ascentStyle}`}
            comment={send.note}
            meta={nativeGradeArray("boulder")[send.suggestedGrade]}
            trailing={
              <span className="text-sm" aria-label={`${send.rating} out of 5 stars`}>
                {send.rating} ★
              </span>
            }
          />
        ))}
      </div>
    </div>
  );
}

export function DemoProjects() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Alex has one open project. Open its sessions to see what to try next.
      </p>
      <ListRow
        title={TOUR_DEMO_PROJECT.name}
        meta={TOUR_DEMO_PROJECT.grade}
        subtitle={`${TOUR_DEMO_PROJECT.sessions.length} sessions · Last: March 14`}
      />
      <Button
        variant="secondary"
        aria-expanded={expanded}
        aria-controls="demo-project-sessions"
        onPress={() => setExpanded(!expanded)}
      >
        {expanded ? "Hide sessions" : "See Alex's sessions"}
      </Button>
      <div id="demo-project-sessions" hidden={!expanded} className="divide-y divide-border">
        {TOUR_DEMO_PROJECT.sessions.map((entry) => (
          <ListRow key={entry.id} title={entry.date} comment={entry.note} />
        ))}
      </div>
      <p className="rounded-lg bg-surface-secondary p-3 text-sm">
        When Alex logs a first send of The Long Way, it leaves Projects and appears in Sends. Both
        earlier sessions stay in Journal.
      </p>
    </div>
  );
}

export function DemoAnalytics() {
  const [showDay, setShowDay] = useState(false);
  const analytics = TOUR_DEMO_ANALYTICS;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <StatTiles
        className="grid-cols-3"
        tiles={[
          { label: "Sends", value: analytics.sendCount },
          { label: "Days out", value: analytics.daysOut },
          { label: "Hardest", value: analytics.hardest[0].label },
        ]}
      />
      <div>
        <h3 className="mb-2 text-sm font-medium">Boulder progression</h3>
        <ProgressionChart type="boulder" points={analytics.progression[0].points} />
        <p className="text-xs text-muted">
          January: V2 → February: V4 → March: V3. Alex's personal best stays V4.
        </p>
      </div>
      <Button
        variant="secondary"
        aria-expanded={showDay}
        aria-controls="demo-analytics-day"
        onPress={() => setShowDay(!showDay)}
      >
        {showDay ? "Hide March 12" : "Why is March 12 only one day out?"}
      </Button>
      <div id="demo-analytics-day" hidden={!showDay}>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {TOUR_DEMO_ENTRIES.filter((entry) => entry.date === "2026-03-12").map((entry) => (
            <li key={entry.id}>
              {entry.climb?.name} · {entry.outcome}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Three outdoor entries on the same date count as one day out. The March 13 gym workout is
          training, so it adds no outdoor day.
        </p>
      </div>
    </div>
  );
}

export function DemoAccount() {
  const [isPrivate, setIsPrivate] = useState(false);
  const [publicJournal, setPublicJournal] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Try changing {TOUR_DEMO_CLIMBER.name}'s example visibility settings.
      </p>
      <Checkbox isSelected={isPrivate} onChange={setIsPrivate}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Private profile
        </Checkbox.Content>
      </Checkbox>
      <Checkbox isSelected={publicJournal} isDisabled={isPrivate} onChange={setPublicJournal}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Public journal
        </Checkbox.Content>
      </Checkbox>
      <div role="status" className="rounded-lg bg-surface-secondary p-4 text-sm">
        <p className="font-medium">What a visitor can see</p>
        <p className="mt-1">
          {isPrivate
            ? "Alex's profile, sends, journal, and analytics are hidden."
            : `Alex's profile, sends, and analytics are visible. The journal is ${publicJournal ? "visible too" : "private"}.`}
        </p>
        <p className="mt-2 text-muted">Projects remain visible only to Alex.</p>
      </div>
    </div>
  );
}
