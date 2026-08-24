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
