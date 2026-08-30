import Papa from "papaparse";
import {
  ASCENT_STYLES,
  GRADE_FEEL_VALUES,
  MAX_COMMENT_LENGTH,
  latestAcceptableSendDate,
  type AscentStyle,
  type GradeFeel,
} from "@/lib/sends";
import type { ClimbType } from "@/lib/grades";

export type ParsedCsv = { headers: string[]; rows: Record<string, string>[] };

export const CLIMB_TYPES = ["boulder", "sport", "trad"] as const;

/** Every distinct, trimmed, non-blank value in `column` across `rows` — used
 * to build the value-mapping step's list of ascent-style/climb-type values
 * the user needs to map. */
export function distinctValues(rows: Record<string, string>[], column: string | null): string[] {
  if (!column) return [];
  const seen = new Set<string>();
  for (const row of rows) {
    const value = (row[column] ?? "").trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

// Cloudflare Workers cap a single invocation at 50 subrequests (Free plan).
// Per db/mutations/import.ts's importSends: ~2 for the session/auth lookup,
// 1 for getUserSentClimbIds, up to IMPORT_BATCH_SIZE for climb resolution
// (one query per row), and a few more for the chunked insert and overwrite
// loops (one subrequest per chunk regardless of how many statements ride in
// that batch). Every row lands in exactly one of those two loops, so
// together they add at most ceil(25/10) + 1 = 4 for an uneven split.
// 25 rows -> ~32 subrequests, comfortable margin under 50.
// The import wizard calls
// importSends once per batch of this size, sequentially, rather than
// passing the whole CSV in one call. Lives here (not in db/mutations.ts)
// because a "use server" file can only export async functions.
export const IMPORT_BATCH_SIZE = 25;

/**
 * Real-world exports (like Sendage's) sometimes have metadata lines before
 * the actual header row (an attribution line, an export date, a blank
 * line). Rather than assuming row 0 is always the header, this detects the
 * header row as the first row whose column count matches the most common
 * column count across all rows — i.e. the shape of the real data table.
 */
export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const rawRows = result.data;
  if (rawRows.length === 0) return { headers: [], rows: [] };

  const lengthCounts = new Map<number, number>();
  for (const r of rawRows) {
    lengthCounts.set(r.length, (lengthCounts.get(r.length) ?? 0) + 1);
  }
  let modeLength = rawRows[0].length;
  let modeCount = -1;
  for (const [length, count] of lengthCounts) {
    if (count > modeCount) {
      modeCount = count;
      modeLength = length;
    }
  }

  const headerIndex = rawRows.findIndex((r) => r.length === modeLength);
  const headers = rawRows[headerIndex] ?? [];
  const rows = rawRows.slice(headerIndex + 1).map((r) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = r[i] ?? "";
    });
    return row;
  });

  return { headers, rows };
}

export type ColumnMapping = {
  date: string | null;
  ascentStyle: string | null;
  climbName: string | null;
  areaName: string | null;
  climbType: string | null; // optional — tiebreaker only
  grade: string | null; // optional
  gradeFeel: string | null; // optional
  rating: string | null; // optional
  comment: string | null; // optional
};

type FieldKey = keyof ColumnMapping;

// Order matters: more specific aliases are matched first so, e.g., "Climb
// Type" is claimed before ascentStyle's generic "type" fallback would
// otherwise grab it.
const FIELD_ORDER: FieldKey[] = [
  "date",
  "climbType",
  "ascentStyle",
  "climbName",
  "areaName",
  "grade",
  "gradeFeel",
  "rating",
  "comment",
];

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  date: ["date sent", "send date", "ascent date", "date"],
  climbType: ["climb type", "discipline"],
  ascentStyle: ["send type", "ascent type", "ascent style", "completion type", "style", "type"],
  climbName: ["climb", "route", "problem", "name"],
  areaName: ["area", "crag", "location", "sector"],
  grade: ["grade", "difficulty"],
  gradeFeel: ["grade feel", "feel"],
  rating: ["rating", "stars"],
  comment: ["comments", "comment", "notes"],
};

/** Case-insensitive/trimmed exact match against common header aliases; the wizard pre-fills the mapping UI with this, and the user can override any of it. */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    date: null,
    ascentStyle: null,
    climbName: null,
    areaName: null,
    climbType: null,
    grade: null,
    gradeFeel: null,
    rating: null,
    comment: null,
  };

  const claimed = new Set<string>();
  const normalized = headers.map((h) => ({ raw: h, norm: h.trim().toLowerCase() }));

  for (const field of FIELD_ORDER) {
    for (const alias of HEADER_ALIASES[field]) {
      const match = normalized.find((h) => !claimed.has(h.raw) && h.norm === alias);
      if (match) {
        mapping[field] = match.raw;
        claimed.add(match.raw);
        break;
      }
    }
  }

  return mapping;
}

export type DateFormat = "iso" | "mdy" | "dmy";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Returns an ISO YYYY-MM-DD string, or null if unparseable/blank under the given format. */
export function parseDateWithFormat(raw: string, format: DateFormat): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (format === "iso") {
    const m = ISO_RE.exec(trimmed);
    if (!m) return null;
    const [, y, mo, d] = m;
    return isValidDate(Number(y), Number(mo), Number(d)) ? trimmed : null;
  }

  const m = SLASH_RE.exec(trimmed);
  if (!m) return null;
  const [, a, b, y] = m;
  const month = format === "mdy" ? Number(a) : Number(b);
  const day = format === "mdy" ? Number(b) : Number(a);
  const year = Number(y);
  if (!isValidDate(year, month, day)) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Tries each candidate format against the sample values, returns whichever parses the most of them (ties favor "iso"). */
export function detectDateFormat(sampleValues: string[]): DateFormat {
  const candidates: DateFormat[] = ["iso", "mdy", "dmy"];
  let best: DateFormat = "iso";
  let bestScore = -1;

  for (const format of candidates) {
    const score = sampleValues.filter(
      (v) => v.trim() && parseDateWithFormat(v, format) !== null,
    ).length;
    if (score > bestScore) {
      bestScore = score;
      best = format;
    }
  }

  return best;
}

export type AscentStyleMapping = Record<string, AscentStyle | "skip">;
export type ClimbTypeMapping = Record<string, ClimbType | "skip">;
export type GradeFeelMapping = Record<string, GradeFeel | "skip">;

/** Pre-fills the value-mapping step's ascent-style dropdowns by matching
 * each distinct CSV value against a known ascent style; anything that
 * doesn't match defaults to "skip" for the user to resolve manually. */
export function guessAscentStyleMapping(values: string[]): AscentStyleMapping {
  const mapping: AscentStyleMapping = {};
  for (const value of values) {
    const match = ASCENT_STYLES.find((t) => t === value.trim().toLowerCase());
    mapping[value] = match ?? "skip";
  }
  return mapping;
}

/** Same as guessAscentStyleMapping, but for the (optional, tiebreaker-only)
 * climb-type column. */
export function guessClimbTypeMapping(values: string[]): ClimbTypeMapping {
  const mapping: ClimbTypeMapping = {};
  for (const value of values) {
    const match = CLIMB_TYPES.find((t) => t === value.trim().toLowerCase());
    mapping[value] = match ?? "skip";
  }
  return mapping;
}

// Other sites rarely use betabook's own low/solid/high wording — soft/stiff
// is the more common phrasing — so the guess covers the unambiguous
// synonyms. Deliberately excludes terms like "sandbagged", which people use
// to mean opposite things; those fall through to "skip" for the user to
// decide rather than being guessed wrong.
const GRADE_FEEL_ALIASES: Record<string, GradeFeel> = {
  soft: "low",
  easy: "low",
  fair: "solid",
  accurate: "solid",
  stiff: "high",
  hard: "high",
};

/** Same as guessAscentStyleMapping, but for the optional grade-feel column.
 * Unmapped values fall back to the "solid" default rather than failing the
 * row — grade feel is never required. */
export function guessGradeFeelMapping(values: string[]): GradeFeelMapping {
  const mapping: GradeFeelMapping = {};
  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    const match =
      GRADE_FEEL_VALUES.find((t) => t === normalized) ?? GRADE_FEEL_ALIASES[normalized];
    mapping[value] = match ?? "skip";
  }
  return mapping;
}

export type NormalizedImportRow = {
  climbName: string;
  areaName: string;
  climbTypeHint: ClimbType | null; // from ClimbTypeMapping, tiebreaker only
  ascentStyle: AscentStyle;
  dateSent: string | null; // ISO if present; blank in the CSV -> null, not a failure
  rating: number | null;
  comment: string | null; // truncated to MAX_COMMENT_LENGTH here, not rejected
  gradeText: string | null;
  gradeFeel: GradeFeel; // optional CSV column; defaults to "solid" if absent/unrecognized
  raw: Record<string, string>; // the original CSV row, kept for a failed-rows export identical to the source
};

export type InvalidImportRow = {
  rowIndex: number;
  raw: Record<string, string>;
  reason: string;
};

/**
 * Applies column mapping + value mappings + date format to every parsed CSV
 * row. Never touches the database — climb resolution happens server-side.
 * Returns both buckets so the wizard can show "N rows ready, M rows can't be
 * imported" before the user ever clicks Finalize.
 */
export function normalizeImportRows(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  ascentStyleMapping: AscentStyleMapping,
  climbTypeMapping: ClimbTypeMapping,
  gradeFeelMapping: GradeFeelMapping,
  dateFormat: DateFormat,
  today: string = new Date().toISOString().slice(0, 10),
): { valid: NormalizedImportRow[]; invalid: InvalidImportRow[] } {
  const valid: NormalizedImportRow[] = [];
  const invalid: InvalidImportRow[] = [];
  // One day past UTC today, since a client's local today can be ahead of
  // UTC's — see latestAcceptableSendDate.
  const latestDateSent = latestAcceptableSendDate(today);

  parsed.rows.forEach((row, rowIndex) => {
    const fail = (reason: string) => invalid.push({ rowIndex, raw: row, reason });

    const climbName = mapping.climbName ? (row[mapping.climbName] ?? "").trim() : "";
    if (!climbName) return fail("Missing climb name");

    const areaName = mapping.areaName ? (row[mapping.areaName] ?? "").trim() : "";
    if (!areaName) return fail("Missing area name");

    const rawAscentStyle = mapping.ascentStyle
      ? (row[mapping.ascentStyle] ?? "").trim()
      : "";
    const mappedAscentStyle = rawAscentStyle
      ? ascentStyleMapping[rawAscentStyle]
      : undefined;
    if (!mappedAscentStyle || mappedAscentStyle === "skip") {
      return fail(
        rawAscentStyle
          ? `Unmapped ascent style value "${rawAscentStyle}"`
          : "Missing ascent style",
      );
    }

    const rawDate = mapping.date ? (row[mapping.date] ?? "").trim() : "";
    let dateSent: string | null = null;
    if (rawDate) {
      dateSent = parseDateWithFormat(rawDate, dateFormat);
      if (dateSent === null) return fail(`Unparseable date "${rawDate}"`);
      if (dateSent > latestDateSent) return fail(`Date "${rawDate}" is in the future`);
    }

    const rawClimbType = mapping.climbType ? (row[mapping.climbType] ?? "").trim() : "";
    const mappedClimbType = rawClimbType ? climbTypeMapping[rawClimbType] : undefined;
    const climbTypeHint: ClimbType | null =
      mappedClimbType && mappedClimbType !== "skip" ? mappedClimbType : null;

    const rawRating = mapping.rating ? (row[mapping.rating] ?? "").trim() : "";
    const ratingNum = rawRating ? Number(rawRating) : null;
    const rating =
      ratingNum !== null && Number.isInteger(ratingNum) && ratingNum >= 1 && ratingNum <= 5
        ? ratingNum
        : null;

    const rawComment = mapping.comment ? (row[mapping.comment] ?? "").trim() : "";
    const comment = rawComment
      ? rawComment.length > MAX_COMMENT_LENGTH
        ? rawComment.slice(0, MAX_COMMENT_LENGTH)
        : rawComment
      : null;

    const gradeText = mapping.grade ? (row[mapping.grade] ?? "").trim() || null : null;

    const rawGradeFeel = mapping.gradeFeel ? (row[mapping.gradeFeel] ?? "").trim() : "";
    const mappedGradeFeel = rawGradeFeel ? gradeFeelMapping[rawGradeFeel] : undefined;
    // Unmapped or explicitly ignored grade feel falls back to the "solid"
    // default — unlike ascent style, it never invalidates a row.
    const gradeFeel: GradeFeel =
      mappedGradeFeel && mappedGradeFeel !== "skip" ? mappedGradeFeel : "solid";

    valid.push({
      climbName,
      areaName,
      climbTypeHint,
      ascentStyle: mappedAscentStyle,
      dateSent,
      rating,
      comment,
      gradeText,
      gradeFeel,
      raw: row,
    });
  });

  return { valid, invalid };
}

export type NotFoundRow = {
  climbName: string;
  areaName: string;
  dateSent: string | null;
  reason: "climb-not-found" | "climb-ambiguous";
  raw: Record<string, string>; // the original CSV row, for a failed-rows export identical to the source
};

export type BatchErrorRow = { rows: NormalizedImportRow[]; message: string };

const REASON_COLUMN = "Import Failure Reason";

/**
 * Builds a CSV of every row that couldn't be imported — the client-side
 * `invalid` bucket (normalization failures), the server-reported `notFound`
 * bucket (climb resolution failures), and any `batchErrors` (rows whose
 * batch request itself failed) — so the user can review and fix them
 * outside the wizard. Every row's original CSV columns/values are carried
 * through unchanged (via each row's own `raw`), with one column appended
 * explaining why it failed — the export otherwise matches the source file
 * exactly, so it can be edited and re-uploaded as-is.
 */
export function buildFailedRowsCsv(
  headers: string[],
  invalid: InvalidImportRow[],
  notFound: NotFoundRow[],
  batchErrors: BatchErrorRow[],
): string {
  const fields = [...headers, REASON_COLUMN];
  const toRow = (raw: Record<string, string>, reason: string) => [
    ...headers.map((h) => raw[h] ?? ""),
    reason,
  ];

  const data: string[][] = [];

  for (const r of invalid) {
    data.push(toRow(r.raw, r.reason));
  }

  for (const r of notFound) {
    data.push(
      toRow(r.raw, r.reason === "climb-not-found" ? "Climb not found" : "Ambiguous climb match"),
    );
  }

  for (const batch of batchErrors) {
    for (const r of batch.rows) {
      data.push(toRow(r.raw, `Not attempted: ${batch.message}`));
    }
  }

  return Papa.unparse({ fields, data });
}
