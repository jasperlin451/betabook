import { decode } from "html-entities";

/** Some exporters run their text through an encoder twice ("&amp;rsquo;"), so
 * one pass isn't always enough; the cap stops a deliberately written
 * "&amp;amp;amp;…" from unravelling indefinitely. */
const MAX_PASSES = 3;

/**
 * Turns HTML entities back into the characters they stand for, so a
 * third-party export's "One of the best climbs I&rsquo;ve ever done" reads as
 * the apostrophe the climber typed.
 *
 * For cleaning up text that was never meant to be HTML in the first place.
 * The result is stored and rendered as plain text, so decoding "&lt;" back to
 * "<" is safe here in a way it wouldn't be if the output reached markup.
 *
 * `scope: "strict"` is load-bearing: the library's default follows the HTML5
 * parser, which decodes the legacy entities that omit their semicolon, and
 * would rewrite prose like "&notit;" to "¬it;". Requiring the semicolon keeps
 * a climber's literal "R&D" and "Cams #3 & #4" intact.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text.includes("&")) return text;
  let decoded = text;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const next = decode(decoded, { scope: "strict" });
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}
