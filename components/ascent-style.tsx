import type { AscentStyle } from "@/lib/sends";

/** Sentence-case display names for ascent styles — shared by the send rows,
 * the send form's select, and the sends filter so the wording never drifts. */
export const ASCENT_STYLE_LABELS: Record<AscentStyle, string> = {
  onsight: "Onsight",
  flash: "Flash",
  redpoint: "Redpoint",
};

/** Guidebook tick-list notation for an ascent style: filled dot = onsight,
 * half-filled = flash, open circle = redpoint. Drawn as a small inline SVG
 * rather than the ●/◐/○ glyphs, which render at wildly different sizes and
 * weights across platform fonts. Sized to the text line (0.75em) and drawn
 * in currentColor so it follows the surrounding text color — the fill state
 * IS the information, so it never takes a status color. aria-hidden: the
 * adjacent label text carries the meaning for assistive tech. */
export function AscentMark({ type }: { type: AscentStyle }) {
  return (
    <svg viewBox="0 0 16 16" className="size-[0.75em] shrink-0" aria-hidden>
      <circle
        cx="8"
        cy="8"
        r="6"
        stroke="currentColor"
        strokeWidth="2"
        fill={type === "onsight" ? "currentColor" : "none"}
      />
      {type === "flash" && (
        // Left half-disc (the ◐ convention): from the top of the circle to
        // the bottom, arcing counterclockwise through the left side, closed
        // along the vertical diameter. Same radius as the outline circle,
        // whose centered stroke covers the disc's curved edge.
        <path d="M8 2A6 6 0 0 0 8 14Z" fill="currentColor" />
      )}
    </svg>
  );
}

/** An ascent style as its tick-list mark + label — plain text, no chip. The
 * send rows read as a guidebook index (mono grade margin, divide-y, ticks),
 * where a pill background would make this line the loudest thing in a dense
 * trailing stack of peer metadata (rating, date). Chips stay reserved for
 * the discipline taxonomy on climb rows, so each device keeps one meaning:
 * chip = discipline, mark = ascent notation. */
export function AscentStyle({ type }: { type: AscentStyle }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
      <AscentMark type={type} />
      {ASCENT_STYLE_LABELS[type]}
    </span>
  );
}
