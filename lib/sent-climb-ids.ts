/** How many climb ids one sent-state lookup will answer for. The client only
 * ever asks about rows it has actually paged in, and the pagination budget
 * caps that far higher than anyone scrolls — so this is a guard on the public
 * route, not a limit the UI is expected to reach. Past it the client keeps
 * the sent state it already has rather than degrading to a huge query. */
export const MAX_SENT_CLIMB_ID_LOOKUP = 500;

/** Which of `climbIds` the signed-in viewer has sent. Returns [] when signed
 * out, which is also what the route answers. */
export async function fetchSentClimbIds(
  climbIds: readonly number[],
  signal?: AbortSignal,
): Promise<number[]> {
  if (climbIds.length === 0) return [];
  const params = new URLSearchParams({ climbIds: climbIds.join(",") });
  const res = await fetch(`/api/sent-climbs?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Sent-climb lookup failed: ${res.status}`);
  const data: { sentClimbIds: number[] } = await res.json();
  return data.sentClimbIds;
}
