import { nativeGradeArray, type ClimbType } from "@/lib/grades";
import type { AnalyticsSendRow } from "@/db/queries";

/** Which slice of a climber's log the analytics page is reading — grades
 * only compare within one discipline, so "all" keeps per-discipline
 * groupings for every grade-axis chart while the volume stats merge. */
export type DisciplineScope = ClimbType | "all";

export const DISCIPLINE_ORDER: readonly ClimbType[] = ["boulder", "sport", "trad"];

export function parseDisciplineScope(value: string | undefined): DisciplineScope {
  return value === "boulder" || value === "sport" || value === "trad" ? value : "all";
}

export type HardestSend = {
  type: ClimbType;
  grade: number;
  label: string;
  climbId: number;
  climbName: string;
  dateSent: string | null;
};

export type ProgressionPoint = {
  /** YYYY-MM */
  month: string;
  /** Hardest dated send that month (grade ordinal). */
  hardest: number;
  /** Running personal best through that month. */
  best: number;
};

export type DisciplineProgression = { type: ClimbType; points: ProgressionPoint[] };

export type PyramidRow = { grade: number; label: string; count: number };
/** Rows run hardest → easiest, zeros kept, so the shape reads as the
 * classic send pyramid: thin peak on top, base underneath. */
export type DisciplinePyramid = { type: ClimbType; rows: PyramidRow[] };

export type Breakthrough = {
  type: ClimbType;
  grade: number;
  label: string;
  climbId: number;
  climbName: string;
  dateSent: string;
  /** Days since the previous ceiling-raise in this discipline. */
  waitDays: number | null;
};

export type UserAnalytics = {
  scope: DisciplineScope;
  sendCount: number;
  datelessCount: number;
  dateSpan: [string, string] | null;
  /** Disciplines present in scope, boulder → sport → trad. */
  disciplines: ClimbType[];
  /** Hardest send per discipline present (grades don't compare across). */
  hardest: HardestSend[];
  flashCount: number;
  onsightCount: number;
  /** Hardest flash-or-onsight — only when the scope is one discipline. */
  hardestFirstTry: HardestSend | null;
  daysOut: number;
  daysPerMonth: number | null;
  bestYear: { year: number; count: number } | null;
  areaCount: number;
  topArea: { id: number; name: string; count: number } | null;
  progression: DisciplineProgression[];
  pyramid: DisciplinePyramid[];
  /** Every send that raised a ceiling, newest first. */
  breakthroughs: Breakthrough[];
  /** Dated sends per YYYY-MM-DD, for the calendar. */
  sendsByDay: Record<string, number>;
  /** Years with dated sends, ascending. */
  years: number[];
  longestStreak: { days: number; end: string } | null;
  longestLayoff: { days: number; from: string; to: string } | null;
  busiestMonth: { month: string; count: number } | null;
  favoriteWeekday: { weekday: string; count: number } | null;
};

const MS_PER_DAY = 86_400_000;
const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function dayMs(isoDate: string): number {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

function diffDays(fromIso: string, toIso: string): number {
  return Math.round((dayMs(toIso) - dayMs(fromIso)) / MS_PER_DAY);
}

/** "2023-12" → "Dec 2023" — chart/stat month labels. */
export function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  return `${MONTHS_SHORT[Number(m) - 1]} ${year}`;
}

/** Humanized gap for breakthrough waits and layoffs: "12d", "4 mo", "2.2 yr". */
export function formatDaySpan(days: number): string {
  if (days < 1) return "same day";
  if (days < 45) return `${Math.round(days)}d`;
  if (days < 540) return `${Math.round(days / 30.437)} mo`;
  return `${(days / 365.25).toFixed(1)} yr`;
}

/** One discipline's send pyramid from any slice of a log (all time, or one
 * year's sends): counts per grade from the slice's hardest down to its
 * easiest, zeros kept so the shape is real. */
export function buildPyramid(sends: AnalyticsSendRow[], type: ClimbType): PyramidRow[] {
  const scale = nativeGradeArray(type);
  const gradeCounts = new Map<number, number>();
  for (const s of sends) {
    if (s.climbType !== type || s.climbGrade == null || s.climbGrade >= scale.length) continue;
    gradeCounts.set(s.climbGrade, (gradeCounts.get(s.climbGrade) ?? 0) + 1);
  }
  if (gradeCounts.size === 0) return [];

  const indices = [...gradeCounts.keys()];
  const min = Math.min(...indices);
  const max = Math.max(...indices);
  const rows: PyramidRow[] = [];
  for (let grade = max; grade >= min; grade--) {
    rows.push({ grade, label: scale[grade], count: gradeCounts.get(grade) ?? 0 });
  }
  return rows;
}

/** Aggregates one user's full send log into everything the analytics page
 * shows, filtered to `scope`. Pure — see user-analytics.test.ts. */
export function buildUserAnalytics(
  allSends: AnalyticsSendRow[],
  scope: DisciplineScope,
): UserAnalytics {
  const sends = scope === "all" ? allSends : allSends.filter((s) => s.climbType === scope);
  const dated = sends
    .filter((s): s is AnalyticsSendRow & { dateSent: string } => s.dateSent != null)
    .sort((a, b) => (a.dateSent < b.dateSent ? -1 : a.dateSent > b.dateSent ? 1 : 0));

  const disciplines = DISCIPLINE_ORDER.filter((d) => sends.some((s) => s.climbType === d));

  // Hardest send per discipline — first (earliest-dated) send at the top grade.
  const hardest: HardestSend[] = [];
  for (const type of disciplines) {
    const scale = nativeGradeArray(type);
    const graded = sends.filter(
      (s) => s.climbType === type && s.climbGrade != null && s.climbGrade < scale.length,
    );
    if (graded.length === 0) continue;
    const top = graded.reduce((best, s) => {
      if (s.climbGrade! > best.climbGrade!) return s;
      if (s.climbGrade! === best.climbGrade! && s.dateSent != null) {
        if (best.dateSent == null || s.dateSent < best.dateSent) return s;
      }
      return best;
    });
    hardest.push({
      type,
      grade: top.climbGrade!,
      label: scale[top.climbGrade!],
      climbId: top.climbId,
      climbName: top.climbName,
      dateSent: top.dateSent,
    });
  }

  const flashCount = sends.filter((s) => s.ascentStyle === "flash").length;
  const onsightCount = sends.filter((s) => s.ascentStyle === "onsight").length;
  let hardestFirstTry: HardestSend | null = null;
  if (scope !== "all") {
    const scale = nativeGradeArray(scope);
    const firstTries = sends.filter(
      (s) =>
        s.ascentStyle !== "redpoint" && s.climbGrade != null && s.climbGrade < scale.length,
    );
    if (firstTries.length > 0) {
      const top = firstTries.reduce((best, s) => (s.climbGrade! > best.climbGrade! ? s : best));
      hardestFirstTry = {
        type: scope,
        grade: top.climbGrade!,
        label: scale[top.climbGrade!],
        climbId: top.climbId,
        climbName: top.climbName,
        dateSent: top.dateSent,
      };
    }
  }

  // Calendar + consistency, all from dated sends.
  const sendsByDay: Record<string, number> = {};
  for (const s of dated) sendsByDay[s.dateSent] = (sendsByDay[s.dateSent] ?? 0) + 1;
  const days = Object.keys(sendsByDay).sort();
  const years = [...new Set(days.map((d) => Number(d.slice(0, 4))))].sort((a, b) => a - b);

  const dateSpan: [string, string] | null =
    days.length > 0 ? [days[0], days[days.length - 1]] : null;

  let daysPerMonth: number | null = null;
  if (dateSpan) {
    const [fy, fm] = dateSpan[0].split("-").map(Number);
    const [ly, lm] = dateSpan[1].split("-").map(Number);
    const monthSpan = (ly - fy) * 12 + (lm - fm) + 1;
    daysPerMonth = days.length / monthSpan;
  }

  let longestStreak: UserAnalytics["longestStreak"] = null;
  let longestLayoff: UserAnalytics["longestLayoff"] = null;
  let streak = 1;
  for (let i = 0; i < days.length; i++) {
    if (i > 0) {
      const gap = diffDays(days[i - 1], days[i]);
      streak = gap === 1 ? streak + 1 : 1;
      // A gap of 1 is back-to-back climbing days, not a break — only an
      // actual day off the wall counts, so a climber who never missed a day
      // reports no layoff rather than "1d".
      if (gap > 1 && (!longestLayoff || gap > longestLayoff.days)) {
        longestLayoff = { days: gap, from: days[i - 1], to: days[i] };
      }
    }
    if (!longestStreak || streak > longestStreak.days) {
      longestStreak = { days: streak, end: days[i] };
    }
  }

  const byYear = new Map<number, number>();
  const byMonth = new Map<string, number>();
  const byWeekday = new Map<number, number>();
  for (const s of dated) {
    const year = Number(s.dateSent.slice(0, 4));
    const month = s.dateSent.slice(0, 7);
    const weekday = new Date(dayMs(s.dateSent)).getUTCDay();
    byYear.set(year, (byYear.get(year) ?? 0) + 1);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
    byWeekday.set(weekday, (byWeekday.get(weekday) ?? 0) + 1);
  }
  const bestYear = maxEntry(byYear, (year, count) => ({ year, count }));
  const busiestMonth = maxEntry(byMonth, (month, count) => ({ month, count }));
  const favoriteWeekday = maxEntry(byWeekday, (weekday, count) => ({
    weekday: WEEKDAYS[weekday],
    count,
  }));

  // Areas.
  const areaCounts = new Map<number, { id: number; name: string; count: number }>();
  for (const s of sends) {
    const entry = areaCounts.get(s.areaId) ?? { id: s.areaId, name: s.areaName, count: 0 };
    entry.count += 1;
    areaCounts.set(s.areaId, entry);
  }
  let topArea: UserAnalytics["topArea"] = null;
  for (const entry of areaCounts.values()) {
    if (!topArea || entry.count > topArea.count) topArea = entry;
  }

  // Grade-axis charts, one group per discipline.
  const progression: DisciplineProgression[] = [];
  const pyramid: DisciplinePyramid[] = [];
  const breakthroughs: Breakthrough[] = [];
  for (const type of disciplines) {
    const scale = nativeGradeArray(type);
    const graded = dated.filter(
      (s) => s.climbType === type && s.climbGrade != null && s.climbGrade < scale.length,
    );

    const hardestByMonth = new Map<string, number>();
    for (const s of graded) {
      const month = s.dateSent.slice(0, 7);
      hardestByMonth.set(month, Math.max(hardestByMonth.get(month) ?? 0, s.climbGrade!));
    }
    const months = [...hardestByMonth.keys()].sort();
    const points: ProgressionPoint[] = [];
    for (const month of months) {
      const monthHardest = hardestByMonth.get(month)!;
      const prevBest = points.length > 0 ? points[points.length - 1].best : 0;
      points.push({ month, hardest: monthHardest, best: Math.max(prevBest, monthHardest) });
    }
    if (points.length > 0) progression.push({ type, points });

    const rows = buildPyramid(sends, type);
    if (rows.length > 0) pyramid.push({ type, rows });

    let ceiling = -1;
    let previousDate: string | null = null;
    for (const s of graded) {
      if (s.climbGrade! <= ceiling) continue;
      breakthroughs.push({
        type,
        grade: s.climbGrade!,
        label: scale[s.climbGrade!],
        climbId: s.climbId,
        climbName: s.climbName,
        dateSent: s.dateSent,
        waitDays: previousDate == null ? null : diffDays(previousDate, s.dateSent),
      });
      ceiling = s.climbGrade!;
      previousDate = s.dateSent;
    }
  }
  breakthroughs.sort((a, b) => (a.dateSent < b.dateSent ? 1 : a.dateSent > b.dateSent ? -1 : 0));

  return {
    scope,
    sendCount: sends.length,
    datelessCount: sends.length - dated.length,
    dateSpan,
    disciplines,
    hardest,
    flashCount,
    onsightCount,
    hardestFirstTry,
    daysOut: days.length,
    daysPerMonth,
    bestYear,
    areaCount: areaCounts.size,
    topArea,
    progression,
    pyramid,
    breakthroughs,
    sendsByDay,
    years,
    longestStreak,
    longestLayoff,
    busiestMonth,
    favoriteWeekday,
  };
}

function maxEntry<K, V>(map: Map<K, number>, make: (key: K, count: number) => V): V | null {
  let best: { key: K; count: number } | null = null;
  for (const [key, count] of map) {
    if (!best || count > best.count) best = { key, count };
  }
  return best ? make(best.key, best.count) : null;
}
