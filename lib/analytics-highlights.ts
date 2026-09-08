import type { ClimbType } from "@/lib/grades";

export type HighlightSession = {
  id: number;
  entryDate: string;
  climbId: number;
  climbName: string;
  climbType: ClimbType;
  sent: boolean;
  isAscent: boolean;
  companions: { id: string; name: string }[];
};

export function buildAnalyticsHighlights(
  rows: readonly HighlightSession[],
  scope: ClimbType,
  years: readonly number[],
) {
  const sessions = rows
    .filter(
      (row) =>
        row.climbType === scope &&
        (!years.length || years.includes(Number(row.entryDate.slice(0, 4)))),
    )
    .toSorted((a, b) => a.entryDate.localeCompare(b.entryDate) || a.id - b.id);
  const climbs = new Map<
    number,
    {
      id: number;
      name: string;
      sessions: number;
      repeats: number;
      firstSend: string | null;
      attempts: number;
    }
  >();
  const partners = new Map<string, { id: string; name: string; days: Set<string> }>();
  const weeks = new Set<number>();
  for (const row of sessions) {
    const climb = climbs.get(row.climbId) ?? {
      id: row.climbId,
      name: row.climbName,
      sessions: 0,
      repeats: 0,
      firstSend: null,
      attempts: 0,
    };
    climb.sessions += 1;
    if (!climb.firstSend) climb.attempts += 1;
    if (row.isAscent) climb.firstSend = row.entryDate;
    if (row.sent && !row.isAscent) climb.repeats += 1;
    climbs.set(row.climbId, climb);
    for (const companion of row.companions) {
      const partner = partners.get(companion.id) ?? { ...companion, days: new Set<string>() };
      partner.days.add(row.entryDate);
      partners.set(companion.id, partner);
    }
    const day = new Date(`${row.entryDate}T00:00:00Z`);
    weeks.add(day.getTime() / 86400000 - ((day.getUTCDay() + 6) % 7));
  }
  const byClimb = [...climbs.values()];
  const biggestProject =
    byClimb.toSorted((a, b) => b.sessions - a.sessions || a.id - b.id)[0] ?? null;
  const persistence =
    byClimb
      .filter((c) => c.firstSend && c.attempts > 1)
      .toSorted((a, b) => b.attempts - a.attempts || a.id - b.id)[0] ?? null;
  const favoriteRepeat =
    byClimb
      .filter((c) => c.repeats > 0)
      .toSorted((a, b) => b.repeats - a.repeats || a.id - b.id)[0] ?? null;
  const partner = [...partners.values()].toSorted(
    (a, b) => b.days.size - a.days.size || a.id.localeCompare(b.id),
  )[0];
  let streak = 0,
    current = 0,
    previous = -Infinity;
  for (const week of [...weeks].sort((a, b) => a - b)) {
    current = week === previous + 7 ? current + 1 : 1;
    streak = Math.max(streak, current);
    previous = week;
  }
  return {
    biggestProject,
    persistence,
    favoriteRepeat,
    partner: partner ? { id: partner.id, name: partner.name, days: partner.days.size } : null,
    climbingStreak: streak,
  };
}
