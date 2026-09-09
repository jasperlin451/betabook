const NEW_CARDS = ["partner", "biggestProject", "persistence", "favoriteRepeat"] as const;
export const DEFAULT_CARDS = [
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
  ...NEW_CARDS,
] as const;
const NEW_CHARTS = ["volume", "flashRate"] as const;
const DEFAULT_CHARTS = [
  "progression",
  "pyramid",
  "breakthroughs",
  "calendar",
  ...NEW_CHARTS,
] as const;
export type AnalyticsCardId = (typeof DEFAULT_CARDS)[number];
type AnalyticsChartId = (typeof DEFAULT_CHARTS)[number];
export type AnalyticsItemId = AnalyticsCardId | AnalyticsChartId;
export type AnalyticsLayout = {
  version: 1;
  cards: AnalyticsCardId[];
  charts: AnalyticsChartId[];
  hidden: AnalyticsItemId[];
};
export const DEFAULT_ANALYTICS_LAYOUT: AnalyticsLayout = {
  version: 1,
  cards: [...DEFAULT_CARDS],
  charts: [...DEFAULT_CHARTS],
  hidden: ["streak", "busiestMonth", "areas", "favoriteDay", "layoff", ...NEW_CARDS, ...NEW_CHARTS],
};

function normalizeOrder<T extends string>(value: unknown, defaults: readonly T[]): T[] {
  const requested = Array.isArray(value)
    ? value.filter((id): id is T => typeof id === "string" && defaults.includes(id as T))
    : [];
  return [...new Set([...requested, ...defaults])];
}

export function parseAnalyticsLayout(value: unknown): AnalyticsLayout {
  if (typeof value !== "object" || value === null || !("version" in value) || value.version !== 1)
    return DEFAULT_ANALYTICS_LAYOUT;
  const saved = value as Record<string, unknown>;
  const allowed = new Set<string>([...DEFAULT_CARDS, ...DEFAULT_CHARTS]);
  const hidden = Array.isArray(saved.hidden)
    ? saved.hidden.filter((id): id is AnalyticsItemId => typeof id === "string" && allowed.has(id))
    : DEFAULT_ANALYTICS_LAYOUT.hidden;
  const missingNewCards = Array.isArray(saved.cards)
    ? NEW_CARDS.filter((id) => !(saved.cards as unknown[]).includes(id))
    : NEW_CARDS;
  const missingNewCharts = Array.isArray(saved.charts)
    ? NEW_CHARTS.filter((id) => !(saved.charts as unknown[]).includes(id))
    : NEW_CHARTS;
  return {
    version: 1,
    cards: normalizeOrder(saved.cards, DEFAULT_CARDS),
    charts: normalizeOrder(saved.charts, DEFAULT_CHARTS),
    hidden: [...new Set([...hidden, ...missingNewCards, ...missingNewCharts])],
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
