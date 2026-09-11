"use client";

import { Button } from "@heroui/react";
import { clsx } from "clsx";
import { ChevronDown, CirclePlus } from "lucide-react";
import { useId } from "react";

import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { ProjectSessionNotes } from "@/components/journal/project-session-notes";
import { AppLink } from "@/components/ui/app-link";
import { cardClass } from "@/components/ui/card";
import { ClampedComment } from "@/components/ui/clamped-comment";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { EYEBROW_CLASS } from "@/components/ui/eyebrow";
import { Grade } from "@/components/ui/grade";
import type { JournalEntry, OpenProject } from "@/db/queries";
import { formatCount } from "@/lib/format";
import { daysBetween, describeDaysAgo, formatDate } from "@/lib/format-date";
import { formatGrade } from "@/lib/grades";
import { climbHref } from "@/lib/slug";

/** An open project with the sessions the server preloaded for it. */
export type ProjectWithSessions = OpenProject & { sessions: JournalEntry[] };

type ProjectCardProps = {
  project: ProjectWithSessions;
  userId: string;
  /** Today as a civil date, or `null` until the client resolves it. The
   * server cannot know the reader's timezone, so how long ago the last
   * session was only joins the meta line after mount. */
  today: string | null;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onLogSession: () => void;
};

/** One open project: what it is, how long it has been going, the last thing
 * the climber wrote about it, and its full session history a click away.
 *
 * The notes panel stays mounted while collapsed so a project whose older
 * sessions have been paged in keeps them — reopening a long project is free
 * the second time. */
export function ProjectCard({
  project,
  userId,
  today,
  isExpanded,
  onExpandedChange,
  onLogSession,
}: ProjectCardProps) {
  const panelId = useId();
  const latestNote = project.sessions.find((entry) => entry.body != null);
  const daysSince = today == null ? null : daysBetween(project.lastSession, today);

  return (
    <article className={clsx(cardClass("sm", "bordered"), "flex flex-col gap-3")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="min-w-0 truncate font-display text-xl font-semibold tracking-tight">
            <AppLink href={climbHref(project.climbId, project.climbName)}>
              {project.climbName}
            </AppLink>
          </h3>
          <AreaBreadcrumb areaId={project.areaId} areaName={project.areaName} ancestors={[]} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Grade size="md">{formatGrade(project.climbType, project.climbGrade)}</Grade>
          <DisciplineChip type={project.climbType} />
        </div>
      </div>

      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted">
        <span className="font-medium text-foreground tabular-nums">
          {formatCount(project.sessionCount, "session")}
        </span>
        {/* A project worked on one day only would otherwise print that date
         * twice, once as "Since" and once as "Last". */}
        {project.firstSession !== project.lastSession && (
          <>
            <Separator />
            <span>
              Since <time dateTime={project.firstSession}>{formatDate(project.firstSession)}</time>
            </span>
          </>
        )}
        <Separator />
        <span>
          Last <time dateTime={project.lastSession}>{formatDate(project.lastSession)}</time>
        </span>
        {daysSince != null && (
          <>
            <Separator />
            <span>{describeDaysAgo(daysSince)}</span>
          </>
        )}
      </p>

      {!isExpanded && latestNote?.body != null && (
        <div className="flex flex-col gap-1 rounded-panel bg-surface-tertiary p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className={EYEBROW_CLASS}>Latest note</span>
            <time dateTime={latestNote.entryDate} className="text-xs text-muted">
              {formatDate(latestNote.entryDate)}
            </time>
          </div>
          <div className="text-sm leading-relaxed text-foreground">
            <ClampedComment>{latestNote.body}</ClampedComment>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* AppLink's recipe on a button, as in ClampedComment: a boxed
         * control here would compete with the card's own Log session. */}
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          onClick={() => onExpandedChange(!isExpanded)}
          className="link inline-flex items-center gap-1 text-sm font-medium focus-visible:status-focused"
        >
          {isExpanded ? "Hide sessions" : sessionsLabel(project)}
          <ChevronDown
            aria-hidden
            className={clsx("size-4 transition-transform", isExpanded && "rotate-180")}
          />
        </button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5"
          aria-label={`Log a session on ${project.climbName}`}
          onPress={onLogSession}
        >
          <CirclePlus className="size-4" />
          Log session
        </Button>
      </div>

      <div id={panelId} hidden={!isExpanded}>
        <ProjectSessionNotes
          userId={userId}
          climbId={project.climbId}
          sessionCount={project.sessionCount}
          initialSessions={project.sessions}
        />
      </div>
    </article>
  );
}

/** Says what opening the panel is worth: the notes when there are any, the
 * bare history when the climber only logged dates. */
function sessionsLabel(project: OpenProject): string {
  return project.noteCount > 0
    ? `Read ${formatCount(project.noteCount, "note")}`
    : "Session history";
}

function Separator() {
  return <span aria-hidden>·</span>;
}
