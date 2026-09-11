"use client";

import { CompanionList } from "@/components/journal/companion-list";
import { ClampedComment } from "@/components/ui/clamped-comment";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import type { JournalEntry } from "@/db/queries";
import { usePagedList } from "@/hooks/use-paged-list";
import { apiFetch } from "@/lib/api-client";
import { DEFAULT_JOURNAL_FILTER, journalFilterToSearchParams } from "@/lib/filters/journal-filter";
import { formatDate } from "@/lib/format-date";

type ProjectSessionNotesProps = {
  userId: string;
  climbId: number;
  /** Every session on this project, including the ones not preloaded —
   * what tells the list whether there is any older history to page in. */
  sessionCount: number;
  initialSessions: JournalEntry[];
};

/** A project's sessions, newest first, each with whatever the climber wrote
 * that day. The card arrives holding the most recent few (see
 * `getOpenProjectSessions`), so opening one costs no request at all; a
 * longer project pages its older sessions in from the journal API, which
 * already answers the same entry shape filtered to one climb. */
export function ProjectSessionNotes({
  userId,
  climbId,
  sessionCount,
  initialSessions,
}: ProjectSessionNotesProps) {
  const { items, hasMore, loadingMore, loadMoreFailed, loadMore } = usePagedList<
    JournalEntry,
    null
  >({
    initialItems: initialSessions,
    initialHasMore: sessionCount > initialSessions.length,
    initialMeta: null,
    itemKey: (entry) => entry.id,
    fetchPage: async (_offset, _page, lastItem, signal) => {
      const params = journalFilterToSearchParams({
        ...DEFAULT_JOURNAL_FILTER,
        view: "sessions",
        climbId,
      });
      if (lastItem) {
        params.set("cursorDate", lastItem.entryDate);
        params.set("cursorId", String(lastItem.id));
      }
      const response = await apiFetch(`/api/users/${userId}/journal?${params}`, { signal });
      if (!response.ok) throw new Error("Failed to load more sessions");
      const data = (await response.json()) as { entries: JournalEntry[]; hasMore: boolean };
      return { items: data.entries, hasMore: data.hasMore, meta: null };
    },
    mergeMeta: () => null,
  });

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4 border-l border-separator pl-4">
        {items.map((entry) => (
          <li key={entry.id} className="relative flex flex-col gap-1">
            {/* The tick on the timeline rule: -left-[1.3125rem] backs the
             * dot out over the ol's pl-4 and centres it on the 1px rule. */}
            <span
              aria-hidden
              className="absolute top-1.5 -left-[1.3125rem] size-2 rounded-full bg-border"
            />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <time dateTime={entry.entryDate} className="text-sm font-medium text-foreground">
                {formatDate(entry.entryDate)}
              </time>
              {entry.tags.map((tag) => (
                <span key={tag} className="text-xs text-muted">
                  #{tag}
                </span>
              ))}
            </div>
            <CompanionList companions={entry.companions} />
            {entry.body == null ? (
              <p className="text-sm text-muted italic">No note on this session.</p>
            ) : (
              <div className="text-sm leading-relaxed text-foreground">
                <ClampedComment>{entry.body}</ClampedComment>
              </div>
            )}
          </li>
        ))}
      </ol>
      {hasMore && (
        <LoadMoreButton onPress={loadMore} loading={loadingMore} failed={loadMoreFailed} />
      )}
    </div>
  );
}
