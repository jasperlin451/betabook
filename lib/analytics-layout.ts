import { z } from "zod";

/** The catalog lists everything available; a layout lists only visible items. */
export const ANALYTICS_CARD_IDS = [
  "sends",
  "hardest",
  "days",
  "firstTry",
  "bestYear",
  "streak",
  "busiestMonth",
  "areas",
  "favoriteDay",
  "layoff",
  "partner",
  "biggestProject",
  "persistence",
  "favoriteRepeat",
] as const;
const ANALYTICS_CHART_IDS = [
  "progression",
  "pyramid",
  "breakthroughs",
  "calendar",
  "volume",
  "flashRate",
] as const;
const cardId = z.enum(ANALYTICS_CARD_IDS);
const chartId = z.enum(ANALYTICS_CHART_IDS);
const unique = (items: readonly string[]) => new Set(items).size === items.length;

/** Writes are strict: invalid IDs, duplicates, and extra fields are rejected. */
export const analyticsLayoutSchema = z.strictObject({
  version: z.literal(2),
  cards: z.array(cardId).refine(unique, "Duplicate cards"),
  charts: z.array(chartId).refine(unique, "Duplicate charts"),
});
export type AnalyticsLayout = z.infer<typeof analyticsLayoutSchema>;
export type AnalyticsCardId = z.infer<typeof cardId>;
export type AnalyticsItemId = AnalyticsCardId | z.infer<typeof chartId>;
export const DEFAULT_ANALYTICS_LAYOUT: AnalyticsLayout = {
  version: 2,
  cards: ["sends", "hardest", "days", "firstTry", "bestYear"],
  charts: ["progression", "pyramid", "breakthroughs", "calendar"],
};

// Stored preferences tolerate retired IDs; new catalog items are never added automatically.
const storedLayoutSchema = z.discriminatedUnion("version", [
  z.object({
    version: z.literal(1),
    cards: z.array(z.string()),
    charts: z.array(z.string()),
    hidden: z.array(z.string()),
  }),
  z.object({ version: z.literal(2), cards: z.array(z.string()), charts: z.array(z.string()) }),
]);
export function parseAnalyticsLayout(value: unknown): AnalyticsLayout {
  const result = storedLayoutSchema.safeParse(value);
  if (!result.success) return analyticsLayoutSchema.parse(DEFAULT_ANALYTICS_LAYOUT);
  const saved = result.data;
  const hidden = new Set(saved.version === 1 ? saved.hidden : []);
  return {
    version: 2,
    cards: [...new Set(saved.cards)].flatMap((id) => {
      const parsed = cardId.safeParse(id);
      return parsed.success && !hidden.has(id) ? [parsed.data] : [];
    }),
    charts: [...new Set(saved.charts)].flatMap((id) => {
      const parsed = chartId.safeParse(id);
      return parsed.success && !hidden.has(id) ? [parsed.data] : [];
    }),
  };
}

export function moveAnalyticsItem<T extends string>(
  order: readonly T[],
  source: T,
  target: T,
  position: "before" | "after" = "before",
): T[] {
  if (source === target || !order.includes(source) || !order.includes(target)) return [...order];
  const next = order.filter((id) => id !== source);
  next.splice(next.indexOf(target) + (position === "after" ? 1 : 0), 0, source);
  return next;
}
