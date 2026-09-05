/**
 * The name-repair rule for the HTML entity artifacts in `climbs.name`.
 *
 * Kept apart from the script that runs it so the rule that rewrites production
 * names is unit-tested rather than only exercised against the database.
 *
 * The corruption in names is a different shape from the one in send comments:
 * names carry a bare `&amp` with no closing semicolon ("Jekyll &amp Hyde"),
 * where comments carry proper entities ("I&rsquo;ve"). The import decoder in
 * `lib/html-entities.ts` deliberately requires the semicolon — that is what
 * keeps a climber's "Cams #3 & #4" intact — so it will not touch these, and
 * this rule exists instead of reusing it.
 */

/** `&amp;` or a bare `&amp` that isn't the start of a longer word, so
 * "Jekyll &amp Hyde" is repaired while "&ampersand" is left alone. The
 * semicolon form is tried first: otherwise the bare alternative would match
 * inside it and leave the `;` behind. */
const AMP_ARTIFACT = /&amp;|&amp(?![A-Za-z])/g;

/** An exporter that encoded twice leaves "&amp;amp;", which needs a second
 * pass; the cap stops a name that is genuinely written "&amp;amp;amp;…" from
 * unravelling indefinitely. */
const MAX_PASSES = 3;

/** Entity-shaped text this rule does not claim — proper named or numeric
 * references such as `&rsquo;` or `&#39;`. Reported for review rather than
 * guessed at, so a second corruption shape can't be silently left behind. */
const OTHER_ENTITY = /&[A-Za-z][A-Za-z0-9]*;|&#\d+;|&#[Xx][0-9A-Fa-f]+;/;

/** The repaired name, or the input unchanged when the rule finds nothing. */
export function repairClimbName(name: string): string {
  if (!name.includes("&")) return name;
  let repaired = name;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const next = repaired.replace(AMP_ARTIFACT, "&");
    if (next === repaired) break;
    repaired = next;
  }
  return repaired;
}

/** Whether a name still holds entity-shaped text after repair — the operator's
 * signal that another rule is needed before the data is actually clean. */
export function hasUnhandledEntity(name: string): boolean {
  return OTHER_ENTITY.test(repairClimbName(name));
}
