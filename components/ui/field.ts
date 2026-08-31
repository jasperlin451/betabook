/** The one style for raw native form controls (<input>, <select>) that sit
 * inside HeroUI TextFields or alongside HeroUI controls — previously
 * copy-pasted in a dozen places, so a radius or border change never reached
 * them all. Raw controls bypass HeroUI's field theming entirely; this keeps
 * them visually in step with it. */
export const FIELD_CLASS = "rounded-md border border-separator bg-surface px-3 py-2 text-sm";
