"use client";

import { clsx } from "clsx";
import { CircleCheckBig } from "lucide-react";

import { ClimbLogRow } from "@/components/climb-log-row";
import { EntryActionsMenu } from "@/components/journal/entry-actions-menu";
import { AppLink } from "@/components/ui/app-link";
import { Grade } from "@/components/ui/grade";
import { ListRow } from "@/components/ui/list-row";
import type { AreaBreadcrumbs, JournalEntry } from "@/db/queries";
import { formatDate } from "@/lib/format-date";
import { formatGrade } from "@/lib/grades";
import { journalFilterToSearchParams, type JournalFilter } from "@/lib/journal-filter";

function entryLabel(entry: JournalEntry): { text: string; className: string } | null {
  if (entry.isAscent) return null;
  if (entry.kind === "training") {
    return { text: "Training", className: "border-border text-muted" };
  }
  if (!entry.sent) return { text: "Session", className: "border-border text-muted" };
  return { text: "Repeat", className: "border-border text-muted" };
}

function tagHref(userId: string, filter: JournalFilter, tag: string): string {
  const params = journalFilterToSearchParams({
    ...filter,
    tag: filter.tag === tag ? null : tag,
  });
  const query = params.toString();
  const base = `/users/${userId}/journal`;
  return query ? `${base}?${query}` : base;
}

export function JournalEntryRow({
  entry,
  isOwner,
  userId,
  filter,
  areaBreadcrumbs,
}: {
  entry: JournalEntry;
  isOwner: boolean;
  userId: string;
  filter: JournalFilter;
  areaBreadcrumbs: AreaBreadcrumbs;
}) {
  const label = entryLabel(entry);
  const status = entry.isAscent ? (
    <span className="inline-flex items-center gap-1 font-semibold text-success-soft-foreground">
      <CircleCheckBig aria-hidden className="size-4" />
      <span>Sent</span>
    </span>
  ) : (
    label && (
      <span
        className={clsx("rounded-full border px-2 py-0.5 text-xs font-medium", label.className)}
      >
        {label.text}
      </span>
    )
  );
  const tags =
    entry.tags.length > 0 ? (
      <>
        {entry.tags.map((tag) => {
          const active = filter.tag === tag;
          return (
            <AppLink
              key={tag}
              href={tagHref(userId, filter, tag)}
              aria-current={active ? "page" : undefined}
              aria-label={active ? `Clear ${tag} filter` : `Filter journal by ${tag}`}
              className={clsx(
                "text-xs no-underline transition-colors hover:text-foreground",
                active ? "font-medium text-foreground underline underline-offset-4" : "text-muted",
              )}
            >
              #{tag}
            </AppLink>
          );
        })}
      </>
    ) : undefined;
  const actions = isOwner ? <EntryActionsMenu entry={entry} /> : undefined;

  if (
    entry.climbId != null &&
    entry.climbName != null &&
    entry.climbType != null &&
    entry.areaId != null &&
    entry.areaName != null
  ) {
    return (
      <ClimbLogRow
        climb={{
          id: entry.climbId,
          name: entry.climbName,
          areaId: entry.areaId,
          areaName: entry.areaName,
        }}
        areaBreadcrumbs={areaBreadcrumbs}
        grade={<Grade>{formatGrade(entry.climbType, entry.climbGrade)}</Grade>}
        status={status}
        date={entry.entryDate}
        tags={tags}
        comment={entry.body}
        actions={actions}
      />
    );
  }

  return (
    <ListRow
      title={entry.climbName ?? (entry.kind === "training" ? "Training" : "Unknown climb")}
      tags={tags}
      trailing={
        <div className="flex flex-col items-end gap-1 text-sm">
          {status}
          <time dateTime={entry.entryDate} className="text-xs whitespace-nowrap text-muted">
            {formatDate(entry.entryDate)}
          </time>
        </div>
      }
      comment={entry.body}
      actions={actions}
    />
  );
}
