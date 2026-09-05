/** Sends store civil dates as plain "YYYY-MM-DD" strings (see
 * drizzle/schema/sends.ts) — no time, no zone. Formatting goes through UTC
 * on both ends (ISO date-only strings parse as UTC midnight) so the
 * displayed date never shifts a day with the viewer's timezone. */
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-08-28" → "Aug 28, 2026". Missing dates render as "—" — the
 * app-wide fallback for absent row values (grades, ratings, dates). An
 * unparseable string is shown as-is rather than dropped. */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return DATE_FORMAT.format(parsed);
}

export function calendarMonth(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone,
  }).format(date);
}
