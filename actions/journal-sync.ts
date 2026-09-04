import { and, asc, eq, inArray } from "drizzle-orm";

import type { Database } from "@/db/client";
import { journalEntries } from "@/db/schema";
import { ActionError } from "@/lib/action-result";

export type SentJournalEntry = Pick<
  typeof journalEntries.$inferSelect,
  "id" | "climbId" | "entryDate"
>;

export function journalEntryFromSend(
  userId: string,
  climbId: number,
  entryDate: string,
  body: string | null,
) {
  return {
    userId,
    climbId,
    kind: "session" as const,
    sent: true,
    entryDate,
    body,
    tags: null,
  };
}

export async function getSentJournalEntries(
  db: Database,
  userId: string,
  climbIds: number[],
): Promise<SentJournalEntry[]> {
  if (climbIds.length === 0) return [];

  return db
    .select({
      id: journalEntries.id,
      climbId: journalEntries.climbId,
      entryDate: journalEntries.entryDate,
    })
    .from(journalEntries)
    .where(
      and(
        eq(journalEntries.userId, userId),
        eq(journalEntries.sent, true),
        inArray(journalEntries.climbId, climbIds),
      ),
    )
    .orderBy(asc(journalEntries.climbId), asc(journalEntries.entryDate), asc(journalEntries.id));
}

export function groupSentJournalEntries(entries: SentJournalEntry[]) {
  const entriesByClimb = new Map<number, SentJournalEntry[]>();
  for (const entry of entries) {
    if (entry.climbId === null) continue;
    const climbEntries = entriesByClimb.get(entry.climbId) ?? [];
    climbEntries.push(entry);
    entriesByClimb.set(entry.climbId, climbEntries);
  }
  return entriesByClimb;
}

export function assertAscentDateChange(entries: SentJournalEntry[], entryDate: string) {
  const [ascent, next] = entries;
  if (
    ascent &&
    next &&
    (entryDate > next.entryDate || (entryDate === next.entryDate && ascent.id > next.id))
  ) {
    throw new ActionError("The ascent date can't be later than a logged repeat");
  }
}

export function assertRepeatDate(entries: SentJournalEntry[], entryDate: string) {
  const [ascent] = entries;
  if (ascent && entryDate < ascent.entryDate) {
    throw new ActionError("A repeat can't be earlier than the recorded ascent");
  }
}
