import { BOULDER_HUECO, nativeGradeArray, ROPE_YDS, type ClimbType } from "@/lib/grades";
import type { GradeFeel } from "@/lib/sends";
import type { GradeHistogramRow, SuggestedGradeCount } from "@/db/queries";

/** One histogram bar. Boulder buckets are one V grade each; rope buckets
 * collapse letter grades to the number ("5.10a–d" → "5.10"). `range` is the
 * inclusive grade-index span the bucket covers, so a bar click can apply
 * the exact matching grade filter. */
export type GradeBucket = { label: string; count: number; range: [number, number] };

/** One discipline's chart: buckets contiguous from its lowest to highest
 * graded climb (zeros between kept, so the shape is real). */
export type DisciplineHistogram = {
  type: ClimbType;
  buckets: GradeBucket[];
};

export type GradeHistogram = {
  totalClimbs: number;
  /** Climbs with no grade — footnoted rather than given a bar. */
  ungradedCount: number;
  /** Disciplines present, in boulder → sport → trad order. */
  disciplines: ClimbType[];
  /** One chart per discipline present with at least one graded climb, in
   * boulder → sport → trad order. */
  groups: DisciplineHistogram[];
  /** Native-label span of graded climbs, e.g. ["V0", "V8"] / ["5.6", "5.12a"]
   * — rope span covers sport and trad together for the info strip. */
  boulderSpan: [string, string] | null;
  ropeSpan: [string, string] | null;
};

export type LoggedGradeBucket = {
  label: string;
  count: number;
  isPosted: boolean;
  /** How the grade felt to these voters — a "5.12a but soft" vote is a
   * different opinion from a plain "5.12a", so it gets its own slice. */
  feel: GradeFeel;
};

const FEEL_ORDER: Record<GradeFeel, number> = { low: 0, solid: 1, high: 2 };

/** Buckets a single climb's suggested-grade votes for the logged-grades
 * donut: one bucket per (native grade, feel) pair actually voted — letter
 * grades kept, since for one climb the a/b/c/d debate is the whole point —
 * ordered soft-to-hard. The posted grade is always represented so the
 * consensus is read against it, even with zero votes. */
export function buildLoggedGradeBuckets(
  type: ClimbType,
  counts: SuggestedGradeCount[],
  postedGrade: number | null,
): LoggedGradeBucket[] {
  const scale = nativeGradeArray(type);
  const voted = counts
    .filter((row) => row.grade >= 0 && row.grade < scale.length)
    .sort((a, b) => a.grade - b.grade || FEEL_ORDER[a.feel] - FEEL_ORDER[b.feel]);
  if (voted.length === 0) return [];

  const buckets: LoggedGradeBucket[] = voted.map((row) => ({
    label: scale[row.grade],
    count: row.count,
    isPosted: row.grade === postedGrade,
    feel: row.feel,
  }));

  const postedRepresented =
    postedGrade == null ||
    postedGrade < 0 ||
    postedGrade >= scale.length ||
    buckets.some((bucket) => bucket.isPosted);
  if (!postedRepresented) {
    buckets.push({ label: scale[postedGrade as number], count: 0, isPosted: true, feel: "solid" });
  }
  return buckets;
}

/** "5.10a" → "5.10"; grades without a letter pass through. */
function collapseRopeLabel(label: string): string {
  return label.replace(/[a-d]$/, "");
}

/** The full grade-index span a collapsed rope label covers ("5.10" →
 * [5.10a, 5.10d]) — a bucket click filters the whole label, not just the
 * letter grades this particular area happens to hold. */
function ropeLabelSpan(label: string): [number, number] {
  let first = -1;
  let last = -1;
  ROPE_YDS.forEach((grade, i) => {
    if (collapseRopeLabel(grade) === label) {
      if (first === -1) first = i;
      last = i;
    }
  });
  return [first, last];
}

/** Contiguous buckets for one discipline's counts-by-grade-index map:
 * boulder gets one bucket per V grade; rope disciplines collapse letter
 * grades to the number ("5.10a–d" → "5.10"), merging in grade order. */
function bucketize(type: ClimbType, counts: Map<number, number>): GradeBucket[] {
  const indices = [...counts.keys()];
  const min = Math.min(...indices);
  const max = Math.max(...indices);
  const scale = type === "boulder" ? BOULDER_HUECO : ROPE_YDS;
  const buckets: GradeBucket[] = [];
  for (let i = min; i <= max; i++) {
    const raw = scale[i];
    const label = type === "boulder" ? raw : collapseRopeLabel(raw);
    const count = counts.get(i) ?? 0;
    const last = buckets[buckets.length - 1];
    if (last && last.label === label) {
      last.count += count;
    } else {
      buckets.push({
        label,
        count,
        range: type === "boulder" ? [i, i] : ropeLabelSpan(label),
      });
    }
  }
  return buckets;
}

/** Buckets the raw (type, grade, count) rows from getSubtreeGradeHistogram
 * into one chart per discipline plus the info-strip aggregates. Pure —
 * see grade-histogram.test.ts. */
export function buildGradeHistogram(rows: GradeHistogramRow[]): GradeHistogram {
  let totalClimbs = 0;
  let ungradedCount = 0;
  const present = new Set<ClimbType>();
  const countsByType = new Map<ClimbType, Map<number, number>>();

  for (const row of rows) {
    totalClimbs += row.count;
    present.add(row.type);
    if (row.grade == null) {
      ungradedCount += row.count;
      continue;
    }
    const scale = row.type === "boulder" ? BOULDER_HUECO : ROPE_YDS;
    if (row.grade < 0 || row.grade >= scale.length) continue;
    const counts = countsByType.get(row.type) ?? new Map<number, number>();
    counts.set(row.grade, (counts.get(row.grade) ?? 0) + row.count);
    countsByType.set(row.type, counts);
  }

  const groups: DisciplineHistogram[] = [];
  for (const type of ["boulder", "sport", "trad"] as const) {
    const counts = countsByType.get(type);
    if (counts && counts.size > 0) {
      groups.push({ type, buckets: bucketize(type, counts) });
    }
  }

  const boulderIndices = [...(countsByType.get("boulder")?.keys() ?? [])];
  const boulderSpan: [string, string] | null =
    boulderIndices.length > 0
      ? [
          BOULDER_HUECO[Math.min(...boulderIndices)],
          BOULDER_HUECO[Math.max(...boulderIndices)],
        ]
      : null;

  const ropeIndices = [
    ...(countsByType.get("sport")?.keys() ?? []),
    ...(countsByType.get("trad")?.keys() ?? []),
  ];
  const ropeSpan: [string, string] | null =
    ropeIndices.length > 0
      ? [ROPE_YDS[Math.min(...ropeIndices)], ROPE_YDS[Math.max(...ropeIndices)]]
      : null;

  const disciplines = (["boulder", "sport", "trad"] as const).filter((d) => present.has(d));

  return { totalClimbs, ungradedCount, disciplines, groups, boulderSpan, ropeSpan };
}
