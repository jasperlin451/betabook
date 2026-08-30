import { BOULDER_HUECO, nativeGradeArray, ROPE_YDS, type ClimbType } from "@/lib/grades";
import type { GradeHistogramRow, SuggestedGradeCount } from "@/db/queries";

/** One histogram bar. Boulder buckets are one V grade each; rope buckets
 * collapse letter grades to the number ("5.10a–d" → "5.10"). */
export type GradeBucket = { label: string; count: number };

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

export type LoggedGradeBucket = { label: string; count: number; isPosted: boolean };

/** Buckets a single climb's suggested-grade counts for the logged-grades
 * histogram: one bucket per native grade (letter grades kept — for one
 * climb the a/b/c/d debate is the whole point), contiguous from the lowest
 * to highest grade anyone suggested, widened to include the posted grade so
 * the consensus is always read against it. */
export function buildLoggedGradeBuckets(
  type: ClimbType,
  counts: SuggestedGradeCount[],
  postedGrade: number | null,
): LoggedGradeBucket[] {
  const scale = nativeGradeArray(type);
  const byGrade = new Map<number, number>();
  for (const row of counts) {
    if (row.grade >= 0 && row.grade < scale.length) {
      byGrade.set(row.grade, (byGrade.get(row.grade) ?? 0) + row.count);
    }
  }
  if (byGrade.size === 0) return [];

  const indices = [...byGrade.keys()];
  if (postedGrade != null && postedGrade >= 0 && postedGrade < scale.length) {
    indices.push(postedGrade);
  }
  const min = Math.min(...indices);
  const max = Math.max(...indices);

  const buckets: LoggedGradeBucket[] = [];
  for (let i = min; i <= max; i++) {
    buckets.push({ label: scale[i], count: byGrade.get(i) ?? 0, isPosted: i === postedGrade });
  }
  return buckets;
}

/** "5.10a" → "5.10"; grades without a letter pass through. */
function collapseRopeLabel(label: string): string {
  return label.replace(/[a-d]$/, "");
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
      buckets.push({ label, count });
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
