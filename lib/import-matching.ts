import type { ClimbCandidate } from "@/db/queries";
import { formatGrade, parseGrade, type ClimbType } from "@/lib/grades";
import type { NormalizedImportRow } from "@/lib/sends-import";

/** The lookup key for a climb name, computed like SQLite's `LOWER(TRIM(name))`
 * (see findClimbCandidatesByNames): spaces trimmed, ASCII letters lowered,
 * nothing else touched. `toLowerCase()` would fold "É" where SQLite without
 * ICU does not, and the returned `key` must match the CSV name's fold. */
export function foldClimbName(name: string): string {
  return name.replace(/^ +| +$/g, "").replace(/[A-Z]/g, (c) => c.toLowerCase());
}

export type CandidateIndex = ReadonlyMap<string, ClimbCandidate[]>;

/** One representative CSV spelling per fold key — what the wizard sends to
 * resolveImportClimbs, so "Zorro" and "zorro" cost one lookup. */
export function distinctClimbNames(rows: readonly NormalizedImportRow[]): string[] {
  const byKey = new Map<string, string>();
  for (const row of rows) {
    const key = foldClimbName(row.climbName);
    if (!byKey.has(key)) byKey.set(key, row.climbName);
  }
  return [...byKey.values()];
}

/** Groups the server's flat candidate list by key. Candidates keep the
 * server's order (most-ascended first), which doubles as relevance. */
export function indexCandidates(candidates: readonly ClimbCandidate[]): CandidateIndex {
  const index = new Map<string, ClimbCandidate[]>();
  for (const candidate of candidates) {
    const list = index.get(candidate.key);
    if (list) list.push(candidate);
    else index.set(candidate.key, [candidate]);
  }
  return index;
}

/** Adds candidates a later lookup found (see resolveImportClimbsInAreas) to
 * an index, skipping climbs already present. */
export function mergeCandidates(
  index: CandidateIndex,
  extra: readonly ClimbCandidate[],
): CandidateIndex {
  const merged = new Map(index);
  for (const candidate of extra) {
    const list = merged.get(candidate.key) ?? [];
    if (list.some((c) => c.id === candidate.id)) continue;
    merged.set(candidate.key, [...list, candidate]);
  }
  return merged;
}

/** Whether the server cut this name's list to its per-name cap, so climbs
 * with the name may be missing from the index. */
export function isTruncated(candidates: readonly ClimbCandidate[]): boolean {
  return candidates.length > 0 && candidates[0].total > candidates.length;
}

/** Rows whose name was truncated AND that name an area: the one case the
 * capped list can't settle but a name+area lookup can (see
 * resolveImportClimbsInAreas). One pair per distinct (name, area). */
export function areaLookupsNeeded(
  rows: readonly NormalizedImportRow[],
  index: CandidateIndex,
): { name: string; areaName: string }[] {
  const seen = new Set<string>();
  const pairs: { name: string; areaName: string }[] = [];
  for (const row of rows) {
    if (!row.areaName) continue;
    const candidates = index.get(foldClimbName(row.climbName));
    if (!candidates || !isTruncated(candidates)) continue;
    const pairKey = `${foldClimbName(row.climbName)}\0${foldClimbName(row.areaName)}`;
    if (seen.has(pairKey)) continue;
    seen.add(pairKey);
    pairs.push({ name: row.climbName, areaName: row.areaName });
  }
  return pairs;
}

export type PreferredArea = { id: number; name: string };

export type MatchOptions = {
  gradeScale: "native" | "converted";
  /** Areas the user climbs in. A same-named tie resolves toward the candidate
   * under one of these, so one area covers many rows. */
  preferredAreas: readonly PreferredArea[];
};

export type RowMatch =
  /** Exactly one climb survives the hard filters (name, discipline, Area
   * column). `notes` flags anything worth a second look, such as a climb
   * outside the preferred areas, without demoting the match. */
  | { kind: "exact"; climb: ClimbCandidate; notes: string[] }
  /** Several climbs share the name; the soft signals (preferred areas, hint
   * columns, the CSV grade) narrowed them to one. `reason` says which. */
  | { kind: "inferred"; climb: ClimbCandidate; reason: string; alternatives: ClimbCandidate[] }
  /** Several remain. `candidates` is the narrowed set to offer first; `pool`
   * is every same-named climb that passed the hard filters, or every
   * same-named climb when a hard filter emptied the set (`conflict` says
   * what disagreed, as a sentence). `narrowedBy` names the soft signals that
   * cut `pool` down to `candidates`, as a fragment. `total` counts the
   * name's climbs before the server's per-name cap; `truncated` says the cap
   * applied. */
  | {
      kind: "ambiguous";
      candidates: ClimbCandidate[];
      pool: ClimbCandidate[];
      total: number;
      truncated: boolean;
      conflict: string | null;
      narrowedBy: string | null;
    }
  /** No climb of that name at all. */
  | { kind: "none" };

/** The CSV grade as an ordinal in each discipline's table. Text that parses
 * in only one is a discipline in disguise — "v4" can only be a boulder — so
 * it doubles as a type filter; text that parses in both ("6a" is a Font
 * boulder grade and a French route grade) settles nothing about type but
 * still breaks a grade tie within each. */
export function impliedGrades(
  gradeText: string | null,
  scale: MatchOptions["gradeScale"],
): { boulder: number | null; rope: number | null } {
  if (!gradeText) return { boulder: null, rope: null };
  return {
    boulder: parseGrade("boulder", gradeText, scale),
    rope: parseGrade("sport", gradeText, scale),
  };
}

function impliedGradeFor(
  type: ClimbType,
  implied: { boulder: number | null; rope: number | null },
): number | null {
  return type === "boulder" ? implied.boulder : implied.rope;
}

function pathAreas(climb: ClimbCandidate): { id: number; name: string }[] {
  return [...climb.ancestors, { id: climb.areaId, name: climb.areaName }];
}

/** Whether `areaName` names the climb's own area or any ancestor — the same
 * "exactly or as an ancestor" rule the Area column has always used. */
function inArea(climb: ClimbCandidate, areaName: string): boolean {
  const key = foldClimbName(areaName);
  return pathAreas(climb).some((area) => foldClimbName(area.name) === key);
}

function underAreas(climb: ClimbCandidate, areaIds: ReadonlySet<number>): boolean {
  return pathAreas(climb).some((area) => areaIds.has(area.id));
}

/** Where a candidate sits, root-first, for messages. */
export function candidatePath(climb: ClimbCandidate): string {
  return pathAreas(climb)
    .map((area) => area.name)
    .join(" / ");
}

const TYPE_LABEL: Record<ClimbType, string> = { boulder: "boulder", sport: "sport", trad: "trad" };

/** "a", "a and b", "a, b, and c". */
function listWords(words: string[]): string {
  if (words.length <= 1) return words.join("");
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}

/** What disagreed, as a sentence that also works as a failure reason:
 * `predicate` completes "is ..." / "isn't ...". */
function describeConflict(total: number, predicate: string, suffix = ""): string {
  return total === 1
    ? `The one climb with this name isn't ${predicate}${suffix}`
    : `None of the ${total} climbs with this name is ${predicate}${suffix}`;
}

/** Resolves one CSV row against the candidates that share its climb name.
 *
 * Hard filters first (a mapped Climb Type column, the discipline the grade
 * text implies, the Area column), since each is something the file states
 * about the climb. If one empties the set, the same-named climbs are still
 * offered as ambiguous with the conflict spelled out.
 *
 * Then soft signals, only while a tie remains and only if the step keeps at
 * least one candidate: preferred areas, the hint columns in mapped order,
 * then the grade. A truncated list is never resolved by soft signals — the
 * right climb may be among the ones the cap dropped — unless the Area
 * column vouches for the survivors (see areaLookupsNeeded). */
export function matchRow(
  row: NormalizedImportRow,
  index: CandidateIndex,
  options: MatchOptions,
): RowMatch {
  const all = index.get(foldClimbName(row.climbName)) ?? [];
  if (all.length === 0) return { kind: "none" };
  const total = all[0].total;
  const truncated = isTruncated(all);

  const ambiguous = (
    candidates: ClimbCandidate[],
    pool: ClimbCandidate[],
    conflict: string | null,
    narrowedBy: string | null = null,
  ): RowMatch => ({ kind: "ambiguous", candidates, pool, total, truncated, conflict, narrowedBy });

  let candidates = all;

  if (row.climbTypeHint) {
    const kept = candidates.filter((c) => c.type === row.climbTypeHint);
    if (kept.length === 0) {
      return ambiguous(candidates, all, describeConflict(total, `a ${TYPE_LABEL[row.climbTypeHint]} climb`));
    }
    candidates = kept;
  }

  // The climber's grade when they gave one, else the file's posted grade.
  const gradeText = row.gradeText ?? row.postedGradeText;
  const implied = impliedGrades(gradeText, options.gradeScale);
  const impliedType: "boulder" | "rope" | null =
    implied.boulder !== null && implied.rope === null
      ? "boulder"
      : implied.rope !== null && implied.boulder === null
        ? "rope"
        : null;
  if (impliedType) {
    const kept = candidates.filter((c) =>
      impliedType === "boulder" ? c.type === "boulder" : c.type !== "boulder",
    );
    if (kept.length === 0) {
      const noun = impliedType === "boulder" ? "boulder" : "route";
      return ambiguous(
        candidates,
        all,
        describeConflict(total, `a ${noun}`, `, but "${gradeText}" is a ${noun} grade`),
      );
    }
    candidates = kept;
  }

  if (row.areaName) {
    const kept = candidates.filter((c) => inArea(c, row.areaName!));
    if (kept.length === 0) {
      return ambiguous(candidates, all, describeConflict(total, `in "${row.areaName}"`));
    }
    candidates = kept;
  }

  // With the list cut by the server cap, a survivor is only trusted when the
  // Area column picked it out — that lookup fetched every climb of the name
  // in the area, cap or no cap.
  const reliable = !truncated || row.areaName !== null;
  const preferredIds = new Set(options.preferredAreas.map((a) => a.id));

  if (candidates.length === 1 && reliable) {
    const climb = candidates[0];
    const notes: string[] = [];
    if (preferredIds.size > 0 && !underAreas(climb, preferredIds)) {
      notes.push("Not in one of your areas");
    }
    return { kind: "exact", climb, notes };
  }

  const pool = candidates;
  // A step can keep several candidates and a later step decide between
  // them, so each reason is phrased about the eventual winner. The label is
  // the step's generic name, for the note when no single winner emerges.
  const steps: { reason: (chosen: ClimbCandidate) => string; label: string }[] = [];
  const narrow = (
    keep: (c: ClimbCandidate) => boolean,
    reason: (chosen: ClimbCandidate) => string,
    label: string,
  ) => {
    const kept = candidates.filter(keep);
    if (kept.length > 0 && kept.length < candidates.length) {
      candidates = kept;
      steps.push({ reason, label });
    }
    return candidates.length === 1 && reliable;
  };
  const inferred = (): RowMatch => ({
    kind: "inferred",
    climb: candidates[0],
    reason: steps.map((step) => step.reason(candidates[0])).join("; "),
    alternatives: pool.filter((c) => c !== candidates[0]),
  });

  if (preferredIds.size > 0) {
    const done = narrow(
      (c) => underAreas(c, preferredIds),
      (chosen) => {
        const area = options.preferredAreas.find((a) => underAreas(chosen, new Set([a.id])));
        return area ? `in ${area.name}` : "in one of your areas";
      },
      "your areas",
    );
    if (done) return inferred();
  }

  for (const hint of row.areaHints) {
    if (narrow((c) => inArea(c, hint), () => `matches "${hint}"`, `"${hint}"`)) return inferred();
  }

  if (implied.boulder !== null || implied.rope !== null) {
    const done = narrow(
      (c) => c.grade !== null && c.grade === impliedGradeFor(c.type, implied),
      (chosen) => `the only ${formatGrade(chosen.type, chosen.grade)}`,
      `the grade "${gradeText}"`,
    );
    if (done) return inferred();
  }

  return ambiguous(
    candidates,
    pool,
    null,
    steps.length > 0 ? listWords(steps.map((step) => step.label)) : null,
  );
}

/** matchRow over every row. Kept apart from resolveRows so a manual pick
 * doesn't re-run the matching for the whole file. */
export function matchRows(
  rows: readonly NormalizedImportRow[],
  index: CandidateIndex,
  options: MatchOptions,
): RowMatch[] {
  return rows.map((row) => matchRow(row, index, options));
}

/** What the user did about a row, overriding whatever matchRow found. */
export type ManualChoice = { kind: "pick"; climb: ClimbCandidate } | { kind: "skip" };

/** How a row stands in the match step's lists. `matched` and `review` both
 * import as they are; `review` just asks for a glance first. */
export type ResolvedState = "matched" | "review" | "attention" | "picked" | "skipped";

export type ResolvedRow = {
  row: NormalizedImportRow;
  match: RowMatch;
  /** The climb this row will import against, or null if it won't import. */
  climb: ClimbCandidate | null;
  state: ResolvedState;
};

/** Lays the user's choices over the automatic matches. `matches` is
 * matchRows' output for the same `rows`, in the same order. */
export function resolveRows(
  rows: readonly NormalizedImportRow[],
  matches: readonly RowMatch[],
  manual: ReadonlyMap<number, ManualChoice>,
): ResolvedRow[] {
  return rows.map((row, i) => {
    const match = matches[i];
    const choice = manual.get(row.rowIndex);
    if (choice?.kind === "pick") return { row, match, climb: choice.climb, state: "picked" };
    if (choice?.kind === "skip") return { row, match, climb: null, state: "skipped" };
    switch (match.kind) {
      case "exact":
        return {
          row,
          match,
          climb: match.climb,
          state: match.notes.length > 0 ? "review" : "matched",
        };
      case "inferred":
        return { row, match, climb: match.climb, state: "review" };
      default:
        return { row, match, climb: null, state: "attention" };
    }
  });
}

export type ResolvedSummary = Record<ResolvedState, number> & {
  /** Rows that will import: everything with a climb. */
  ready: number;
};

export function summarizeResolved(rows: readonly ResolvedRow[]): ResolvedSummary {
  const summary: ResolvedSummary = {
    matched: 0,
    review: 0,
    attention: 0,
    picked: 0,
    skipped: 0,
    ready: 0,
  };
  for (const resolved of rows) {
    summary[resolved.state]++;
    if (resolved.climb) summary.ready++;
  }
  return summary;
}

/** Rows that resolved to a climb an earlier row already took. One send per
 * climb, so only the first imports (importSends counts the rest as already
 * logged); flagged here rather than on the result screen. Keyed by row
 * index; the value is the row that claimed the climb first. */
export function duplicateClimbRows(rows: readonly ResolvedRow[]): Map<number, NormalizedImportRow> {
  const firstByClimb = new Map<number, NormalizedImportRow>();
  const duplicates = new Map<number, NormalizedImportRow>();
  for (const resolved of rows) {
    if (!resolved.climb) continue;
    const first = firstByClimb.get(resolved.climb.id);
    if (first) duplicates.set(resolved.row.rowIndex, first);
    else firstByClimb.set(resolved.climb.id, resolved.row);
  }
  return duplicates;
}
