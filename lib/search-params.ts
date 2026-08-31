import type { Discipline } from "@/db/queries";
import { ASCENT_STYLES, type AscentStyle } from "@/lib/sends";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function toArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function toRange(
  value: string | string[] | undefined,
  fallback: [number, number],
): [number, number] {
  const values = toArray(value).map(Number).filter(Number.isFinite);
  if (values.length < 2) return fallback;
  return [Math.min(...values), Math.max(...values)];
}

export function parseDisciplines(params: SearchParamsRecord, key = "discipline"): Discipline[] {
  return toArray(params[key]).filter(
    (d): d is Discipline => d === "boulder" || d === "sport" || d === "trad",
  );
}

export function parseAscentStyles(params: SearchParamsRecord, key = "ascentStyle"): AscentStyle[] {
  return toArray(params[key]).filter((s): s is AscentStyle =>
    (ASCENT_STYLES as readonly string[]).includes(s),
  );
}

/** The most suggestions any typeahead may ask a search endpoint for. A cap,
 * not a default: `limit` is client-supplied, and an uncapped one would let a
 * caller turn a suggestion lookup into a full table read. */
export const MAX_SUGGESTION_LIMIT = 10;

/** Reads a search endpoint's `limit`, which puts the request in *suggestion
 * mode*: it caps the rows and — because a popover row shows only a name, a
 * grade, and an area — tells the handler to skip the send-stat and
 * breadcrumb joins the paginated result lists need.
 *
 * Returns null when absent, which is what "load more" sends: pagination is
 * the unlimited path and stays exactly as it was. A present-but-junk value
 * ("0", "abc", "-5") reads as no limit rather than an empty page, so a
 * malformed suggestion request degrades to a normal one instead of silently
 * returning nothing. */
export function parseSuggestionLimit(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get("limit");
  if (raw === null) return null;
  const limit = Math.trunc(Number(raw));
  if (!Number.isFinite(limit) || limit < 1) return null;
  return Math.min(limit, MAX_SUGGESTION_LIMIT);
}

/** Flattens a URLSearchParams into the SearchParamsRecord shape the parse*
 * helpers above expect — used by the "load more" API routes, which receive
 * a real URLSearchParams rather than Next's already-parsed searchParams. */
export function searchParamsToRecord(searchParams: URLSearchParams): SearchParamsRecord {
  const record: SearchParamsRecord = {};
  for (const key of searchParams.keys()) {
    record[key] = searchParams.getAll(key);
  }
  return record;
}
