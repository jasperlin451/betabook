export const PAGE_SIZE = 50;

/**
 * Turns raw user input into an FTS5 prefix query: each word becomes a quoted
 * prefix term (implicitly AND'd together), so "squam" matches "Squamish" and
 * quoting neutralizes FTS5 query-syntax characters (`-`, `:`, `"`, etc.) in
 * the input instead of them causing a syntax error or being interpreted as
 * MATCH operators.
 */
export function toFtsPrefixQuery(raw: string): string {
  return raw
    .split(/\s+/)
    .map((word) => word.replace(/"/g, '""').trim())
    .filter(Boolean)
    .map((word) => `"${word}"*`)
    .join(" ");
}
