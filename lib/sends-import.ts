import Papa from "papaparse";
import {
  ASCENT_STYLES,
  GRADE_FEEL_VALUES,
  MAX_COMMENT_LENGTH,
  type AscentStyle,
  type GradeFeel,
} from "@/lib/sends";
import { parseGrade, type ClimbType } from "@/lib/grades";

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  /** Human-readable parse diagnostics: malformed-CSV errors reported by the
   * parser plus any duplicate-header renames. Non-fatal — the file still
   * parsed — but shown to the user before they map columns. */
  warnings: string[];
};

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
// Per db/mutations.ts's importSends: ~2 for the session/auth lookup, 1 for
// getUserSentClimbIds, up to IMPORT_BATCH_SIZE for climb resolution (one
// query per row), and a couple more for the chunked insert+climbs-aggregate
// db.batch (one subrequest per chunk regardless of how many statements ride
// in that batch). 25 rows -> ~31 subrequests, comfortable margin under 50.
// The import wizard calls
// importSends once per batch of this size, sequentially, rather than
// passing the whole CSV in one call. Lives here (not in db/mutations.ts)
// because a "use server" file can only export async functions.
export const IMPORT_BATCH_SIZE = 25;

const MAX_PARSE_ERROR_WARNINGS = 5;

/**
 * Real-world exports (like Sendage's) sometimes have metadata lines before
 * the actual header row (an attribution line, an export date, a blank
 * line). Rather than assuming row 0 is always the header, this detects the
 * header row as the first row whose column count matches the most common
 * column count across all rows — i.e. the shape of the real data table.
 */
export function parseCsvText(text: string): ParsedCsv {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const warnings: string[] = [];

  // "UndetectableDelimiter" only means papaparse fell back to a comma — it
  // fires for any empty or single-column file, so it's noise rather than a
  // sign of a malformed file. Everything else (unterminated quotes, etc.)
  // is worth showing.
  const parseErrors = result.errors.filter((e) => e.code !== "UndetectableDelimiter");
  for (const err of parseErrors.slice(0, MAX_PARSE_ERROR_WARNINGS)) {
    warnings.push(err.row != null ? `Row ${err.row + 1}: ${err.message}` : err.message);
  }
  if (parseErrors.length > MAX_PARSE_ERROR_WARNINGS) {
    warnings.push(
      `…and ${parseErrors.length - MAX_PARSE_ERROR_WARNINGS} more parse issues`,
    );
  }

  const rawRows = result.data;
  if (rawRows.length === 0) return { headers: [], rows: [], warnings };

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
  const rawHeaders = rawRows[headerIndex] ?? [];

  // Duplicate header names would silently collapse into one field (each row
  // object is keyed by header name) and produce duplicate React keys in the
  // mapping UI — rename repeats deterministically instead, skipping over any
  // name another header already holds.
  const used = new Set<string>();
  const headers = rawHeaders.map((header) => {
    if (!used.has(header)) {
      used.add(header);
      return header;
    }
    let n = 2;
    let renamed = `${header} (${n})`;
    while (used.has(renamed) || rawHeaders.includes(renamed)) {
      n++;
      renamed = `${header} (${n})`;
    }
    used.add(renamed);
    warnings.push(`Duplicate column "${header}" renamed to "${renamed}"`);
    return renamed;
  });

  const rows = rawRows.slice(headerIndex + 1).map((r) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = r[i] ?? "";
    });
    return row;
  });

  return { headers, rows, warnings };
}

export type ColumnMapping = {
  date: string | null;
  ascentStyle: string | null;
  climbName: string | null;
  areaName: string | null;
  climbType: string | null; // optional — tiebreaker only
  grade: string | null; // optional
  suggestedGrade: string | null; // optional — takes precedence over `grade` for the send's suggested grade
  gradeFeel: string | null; // optional
  rating: string | null; // optional
  comment: string | null; // optional
};

type FieldKey = keyof ColumnMapping;

export const REQUIRED_COLUMN_KEYS: readonly FieldKey[] = [
  "ascentStyle",
  "climbName",
  "areaName",
];

/** The required fields (per REQUIRED_COLUMN_KEYS) that aren't mapped to a
 * CSV column yet. The wizard's columns step blocks Next and names these
 * until the user maps each one — an unmapped ascent style would otherwise
 * only surface three steps later as "0 rows ready". */
export function missingRequiredColumns(mapping: ColumnMapping): FieldKey[] {
  return REQUIRED_COLUMN_KEYS.filter((key) => !mapping[key]);
}

// Order matters: more specific aliases are matched first so, e.g., "Climb
// Type" is claimed before ascentStyle's generic "type" fallback would
// otherwise grab it.
const FIELD_ORDER: FieldKey[] = [
  "date",
  "climbType",
  "ascentStyle",
  "climbName",
  "areaName",
  "suggestedGrade",
  "grade",
  "gradeFeel",
  "rating",
  "comment",
];

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  date: ["date sent", "send date", "ascent date", "date"],
  climbType: ["climb type", "discipline"],
  ascentStyle: ["send type", "ascent type", "ascent style", "completion type", "style", "type"],
  climbName: ["climb name", "climb", "route", "problem", "name"],
  areaName: ["area name", "area", "crag", "location", "sector"],
  suggestedGrade: ["suggested grade", "personal grade", "my grade"],
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
    suggestedGrade: null,
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

export type NormalizedImportRow = {
  climbName: string;
  areaName: string;
  climbTypeHint: ClimbType | null; // from ClimbTypeMapping, tiebreaker only
  ascentStyle: AscentStyle;
  dateSent: string | null; // ISO if present; blank in the CSV -> null, not a failure
  rating: number | null;
  comment: string | null; // truncated to MAX_COMMENT_LENGTH here, not rejected
  /** The text that becomes the send's suggested grade — from the Suggested
   * Grade column when one is mapped (it takes precedence: in a betabook
   * export the Grade column is the climb's posted grade, a property of the
   * climb rather than of this send), else from the Grade column. */
  gradeText: string | null;
  /** What a null gradeText means for the send's suggested grade:
   * "posted-grade" — only a Grade column was mapped, so fall back to the
   * climb's posted grade (the pre-existing semantics for third-party CSVs);
   * "no-suggestion" — a Suggested Grade column was mapped and this row's
   * cell was blank, so record no suggestion at all. The latter is what lets
   * a betabook export round-trip losslessly instead of silently replacing
   * every blank suggested grade with the climb's posted grade. */
  blankGradeMeans: "posted-grade" | "no-suggestion";
  gradeFeel: GradeFeel; // optional CSV column; defaults to "solid" if absent/unrecognized
  raw: Record<string, string>; // the original CSV row, kept for a failed-rows export identical to the source
};

export type InvalidImportRow = {
  rowIndex: number;
  raw: Record<string, string>;
  reason: string;
};

/** One kind of silent value adjustment normalizeImportRows makes to rows it
 * still counts as valid — surfaced on the review step so lossy coercions
 * (invalid rating dropped, unrecognized grade dropped, unknown grade feel
 * defaulted, overlong comment truncated) aren't presented as "ready"
 * without comment. */
export type CoercionWarning = {
  field: "suggestedGrade" | "rating" | "gradeFeel" | "comment";
  message: string;
  count: number;
  /** The first few affected rows, pre-formatted for display (e.g. `Row 4: "banana"`). */
  examples: string[];
};

const WARNING_EXAMPLE_LIMIT = 3;

const COERCION_MESSAGES: Record<CoercionWarning["field"], string> = {
  suggestedGrade: "unrecognized grade, imported without a suggested grade",
  rating: "invalid rating, imported without a rating",
  gradeFeel: 'unrecognized grade feel, imported as "solid"',
  comment: `comment longer than ${MAX_COMMENT_LENGTH} characters, truncated`,
};

/** Whether grade text will resolve to a grade ordinal server-side. With a
 * climb-type hint the exact grade table is known; without one, text that
 * parses in neither the boulder nor the rope table is certain to come back
 * null. (Text that parses in only one table can still miss if the climb
 * resolves to the other discipline — that can't be known client-side.) */
function gradeTextParses(
  text: string,
  climbTypeHint: ClimbType | null,
  preference: "native" | "converted",
): boolean {
  if (climbTypeHint) return parseGrade(climbTypeHint, text, preference) !== null;
  return (
    parseGrade("boulder", text, preference) !== null ||
    parseGrade("sport", text, preference) !== null
  );
}

/**
 * Applies column mapping + value mappings + date format to every parsed CSV
 * row. Never touches the database — climb resolution happens server-side.
 * Returns both buckets so the wizard can show "N rows ready, M rows can't be
 * imported" before the user ever clicks Finalize, plus per-field coercion
 * warnings for the value adjustments made to rows in the valid bucket.
 */
export function normalizeImportRows(
  parsed: ParsedCsv,
  mapping: ColumnMapping,
  ascentStyleMapping: AscentStyleMapping,
  climbTypeMapping: ClimbTypeMapping,
  dateFormat: DateFormat,
  options: { today?: string; gradeScalePreference?: "native" | "converted" } = {},
): { valid: NormalizedImportRow[]; invalid: InvalidImportRow[]; warnings: CoercionWarning[] } {
  const {
    today = new Date().toISOString().slice(0, 10),
    gradeScalePreference = "native",
  } = options;
  const valid: NormalizedImportRow[] = [];
  const invalid: InvalidImportRow[] = [];

  const warningBuckets = new Map<CoercionWarning["field"], { count: number; examples: string[] }>();
  const warn = (field: CoercionWarning["field"], rowIndex: number, example: string) => {
    const bucket = warningBuckets.get(field) ?? { count: 0, examples: [] };
    bucket.count++;
    if (bucket.examples.length < WARNING_EXAMPLE_LIMIT) {
      bucket.examples.push(`Row ${rowIndex + 1}: ${example}`);
    }
    warningBuckets.set(field, bucket);
  };

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
      if (dateSent > today) return fail(`Date "${rawDate}" is in the future`);
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
    if (rawRating && rating === null) warn("rating", rowIndex, `"${rawRating}"`);

    const rawComment = mapping.comment ? (row[mapping.comment] ?? "").trim() : "";
    if (rawComment.length > MAX_COMMENT_LENGTH) {
      warn("comment", rowIndex, `${rawComment.length} characters`);
    }
    const comment = rawComment
      ? rawComment.length > MAX_COMMENT_LENGTH
        ? rawComment.slice(0, MAX_COMMENT_LENGTH)
        : rawComment
      : null;

    // The Suggested Grade column, when mapped, is authoritative for the
    // send's suggested grade; the Grade column only fills that role when no
    // Suggested Grade column exists (see NormalizedImportRow.blankGradeMeans).
    const gradeColumn = mapping.suggestedGrade ?? mapping.grade;
    const blankGradeMeans = mapping.suggestedGrade ? ("no-suggestion" as const) : ("posted-grade" as const);
    const gradeText = gradeColumn ? (row[gradeColumn] ?? "").trim() || null : null;
    if (gradeText && !gradeTextParses(gradeText, climbTypeHint, gradeScalePreference)) {
      warn("suggestedGrade", rowIndex, `"${gradeText}"`);
    }

    const rawGradeFeel = mapping.gradeFeel
      ? (row[mapping.gradeFeel] ?? "").trim().toLowerCase()
      : "";
    const recognizedFeel = (GRADE_FEEL_VALUES as readonly string[]).includes(rawGradeFeel);
    const gradeFeel: GradeFeel = recognizedFeel ? (rawGradeFeel as GradeFeel) : "solid";
    if (rawGradeFeel && !recognizedFeel) warn("gradeFeel", rowIndex, `"${rawGradeFeel}"`);

    valid.push({
      climbName,
      areaName,
      climbTypeHint,
      ascentStyle: mappedAscentStyle,
      dateSent,
      rating,
      comment,
      gradeText,
      blankGradeMeans,
      gradeFeel,
      raw: row,
    });
  });

  const warnings: CoercionWarning[] = (
    ["suggestedGrade", "rating", "gradeFeel", "comment"] as const
  ).flatMap((field) => {
    const bucket = warningBuckets.get(field);
    return bucket ? [{ field, message: COERCION_MESSAGES[field], ...bucket }] : [];
  });

  return { valid, invalid, warnings };
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
