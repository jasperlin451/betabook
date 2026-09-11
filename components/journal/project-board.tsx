"use client";

import { Button, useOverlayState } from "@heroui/react";
import { useMemo, useState } from "react";

import { StatTiles } from "@/components/analytics-stat-tiles";
import { JournalEntryDrawer } from "@/components/journal/journal-entry-drawer";
import { ProjectCard, type ProjectWithSessions } from "@/components/journal/project-card";
import { EmptyState } from "@/components/ui/empty-state";
import { OptionSelect } from "@/components/ui/option-select";
import { QueryInput } from "@/components/ui/query-input";
import { useMounted } from "@/hooks/use-mounted";
import { formatCount } from "@/lib/format";
import { daysBetween, describeDaysAgo, formatDate } from "@/lib/format-date";

const SORTS = [
  { value: "recent", label: "Recent activity" },
  { value: "sessions", label: "Most sessions" },
  { value: "longest", label: "Longest running" },
  { value: "name", label: "Name" },
] as const;

type ProjectSort = (typeof SORTS)[number]["value"];

const COMPARATORS: Record<ProjectSort, (a: ProjectWithSessions, b: ProjectWithSessions) => number> =
  {
    recent: (a, b) => b.lastSession.localeCompare(a.lastSession) || a.climbId - b.climbId,
    sessions: (a, b) =>
      b.sessionCount - a.sessionCount || b.lastSession.localeCompare(a.lastSession),
    longest: (a, b) => a.firstSession.localeCompare(b.firstSession) || a.climbId - b.climbId,
    name: (a, b) => a.climbName.localeCompare(b.climbName) || a.climbId - b.climbId,
  };

/** Everything a project carries that a climber might search by. The notes
 * are the preloaded ones, which is what the field's placeholder promises —
 * an older note reachable only by paging is not searched here. */
function haystack(project: ProjectWithSessions): string {
  return [
    project.climbName,
    project.areaName,
    ...project.sessions.flatMap((entry) => [entry.body ?? "", ...entry.tags]),
  ]
    .join("\n")
    .toLowerCase();
}

type ProjectBoardProps = {
  userId: string;
  projects: ProjectWithSessions[];
  /** More open projects exist than the page loaded. */
  hasMore: boolean;
};

/** The projects tab: every open project with its latest note already on the
 * card, searchable and sortable without a round trip, and each one able to
 * open its full session history in place.
 *
 * Filtering and sorting stay client-side deliberately — the page is capped
 * at `OPEN_PROJECT_PAGE_SIZE` projects, and a climber comparing two of them
 * should not lose their expanded panels to a navigation. */
export function ProjectBoard({ userId, projects, hasMore }: ProjectBoardProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProjectSort>("recent");
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());
  const [selected, setSelected] = useState<ProjectWithSessions | null>(null);
  const drawer = useOverlayState();
  const mounted = useMounted();
  // Resolved on the client only: the server has no reader timezone, and a
  // date that disagreed across the hydration boundary would be a mismatch.
  const today = mounted ? new Intl.DateTimeFormat("en-CA").format(new Date()) : null;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? projects.filter((project) => haystack(project).includes(needle))
      : projects;
    return [...matched].sort(COMPARATORS[sort]);
  }, [projects, query, sort]);

  if (projects.length === 0) {
    return (
      <EmptyState message="No open projects. Log a session on a climb you haven't sent and it starts one." />
    );
  }

  const allExpanded = visible.length > 0 && visible.every((p) => expanded.has(p.climbId));

  return (
    <div className="flex flex-col gap-4">
      <StatTiles
        className="grid-cols-2 sm:grid-cols-3"
        tiles={[
          {
            label: "Open projects",
            value: hasMore ? `${projects.length}+` : projects.length,
            sub: `${formatCount(projects.filter((p) => p.noteCount > 0).length, "project")} with notes`,
          },
          {
            label: "Sessions",
            value: totalSessions(projects),
            sub: "Logged on open projects",
          },
          {
            label: "Last out",
            value: <LastOut projects={projects} today={today} />,
            sub: formatDate(lastSessionOf(projects)),
          },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        {/* The search field's own width is `w-96 max-w-full`, and that
         * percentage resolves against this wrapper — so the wrapper, not a
         * shrink-to-content flex group, is what has to be allowed to
         * narrow, or the field keeps its 24rem on a phone. */}
        <div className="min-w-0 flex-1 basis-64">
          <QueryInput
            value={query}
            onChange={setQuery}
            label="Filter projects"
            placeholder="Climb, area, tag or note"
          />
        </div>
        <OptionSelect
          ariaLabel="Sort projects"
          value={sort}
          onChange={setSort}
          options={SORTS}
          className="w-44 max-w-full"
        />
        <Button
          size="sm"
          variant="ghost"
          className="ms-auto"
          onPress={() =>
            setExpanded(allExpanded ? new Set() : new Set(visible.map((p) => p.climbId)))
          }
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState message="No open projects match this search." />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((project) => (
            <li key={project.climbId}>
              <ProjectCard
                project={project}
                userId={userId}
                today={today}
                isExpanded={expanded.has(project.climbId)}
                onExpandedChange={(isExpanded) =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (isExpanded) next.add(project.climbId);
                    else next.delete(project.climbId);
                    return next;
                  })
                }
                onLogSession={() => {
                  setSelected(project);
                  drawer.open();
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <p className="text-sm text-muted">
          Showing the {projects.length} most recently active projects.
        </p>
      )}

      {selected && (
        <JournalEntryDrawer
          climb={{
            id: selected.climbId,
            name: selected.climbName,
            type: selected.climbType,
            grade: selected.climbGrade,
            areaId: selected.areaId,
          }}
          state={drawer}
        />
      )}
    </div>
  );
}

function totalSessions(projects: ProjectWithSessions[]): number {
  let total = 0;
  for (const project of projects) total += project.sessionCount;
  return total;
}

/** Civil dates sort lexicographically, so the newest is a plain max. */
function lastSessionOf(projects: ProjectWithSessions[]): string | null {
  let latest: string | null = null;
  for (const project of projects) {
    if (latest == null || project.lastSession > latest) latest = project.lastSession;
  }
  return latest;
}

/** How long since the climber last touched any open project — the one stat
 * here that needs the reader's own "today", so it holds an em dash until
 * the client has one. */
function LastOut({ projects, today }: { projects: ProjectWithSessions[]; today: string | null }) {
  const lastSession = lastSessionOf(projects);
  const days = lastSession == null || today == null ? null : daysBetween(lastSession, today);
  return <>{days == null ? "—" : describeDaysAgo(days)}</>;
}
