/** "1 ascent" / "42 ascents" — a count with its noun, pluralized. The
 * locale is pinned so server and client render identically. */
export function formatCount(count: number, noun: string, plural = `${noun}s`): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? noun : plural}`;
}
