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

/** How deep any list endpoint will paginate, in rows skipped. SQLite has no
 * way to seek to an OFFSET — it walks and discards every skipped row — so an
 * uncapped `page` makes `?page=1e9` a one-byte request that forces a full
 * index-order scan. 10,000 is well past what "load more" reaches. */
export const MAX_PAGINATION_OFFSET = 10_000;

/** Reads a 1-based `page`, clamped to MAX_PAGINATION_OFFSET rows deep for the
 * caller's `pageSize`. Junk reads as page 1, and past the cap saturates, so a
 * client that keeps asking just stops getting new rows. */
export function parsePage(searchParams: URLSearchParams, pageSize: number): number {
  const page = Math.max(1, Math.trunc(Number(searchParams.get("page"))) || 1);
  return Math.min(page, Math.floor(MAX_PAGINATION_OFFSET / pageSize) + 1);
}

/** Row `offset` for the two endpoints that paginate by offset rather than
 * page number, under the same MAX_PAGINATION_OFFSET budget. Junk reads as 0. */
export function parseOffset(searchParams: URLSearchParams): number {
  const offset = Number(searchParams.get("offset") ?? 0);
  if (!Number.isInteger(offset) || offset < 0) return 0;
  return Math.min(offset, MAX_PAGINATION_OFFSET);
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
