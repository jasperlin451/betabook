export type TourRect = { left: number; top: number; width: number; height: number };
export type TourViewport = { width: number; height: number; top: number };

const EDGE = 12;
const GAP = 20;

/** Clamp callouts to the usable viewport, including when the mobile keyboard is open. */
export function positionTourCard(
  target: TourRect | null,
  viewport: TourViewport,
  cardHeight: number,
) {
  const availableWidth = Math.max(0, viewport.width - EDGE * 2);
  const width = Math.min(344, availableWidth);
  const bottom = viewport.top + viewport.height - cardHeight - EDGE;
  if (viewport.width < 768 || !target) {
    return {
      left: viewport.width < 768 ? EDGE : (viewport.width - width) / 2,
      top: Math.max(viewport.top + EDGE, bottom),
      width: viewport.width < 768 ? availableWidth : width,
    };
  }
  const maxLeft = viewport.width - width - EDGE;
  const top = Math.max(viewport.top + EDGE, Math.min(target.top, bottom));
  if (target.left + target.width + GAP <= maxLeft)
    return { left: target.left + target.width + GAP, top, width };
  if (target.left - GAP - width >= EDGE) return { left: target.left - GAP - width, top, width };
  const left = Math.max(EDGE, Math.min(target.left, maxLeft));
  const below = target.top + target.height + GAP;
  if (below <= bottom) return { left, top: below, width };
  return {
    left,
    top: Math.max(viewport.top + EDGE, Math.min(target.top - cardHeight - GAP, bottom)),
    width,
  };
}

export function tourTargetScrollDelta(
  target: TourRect,
  viewport: TourViewport,
  cardHeight: number,
) {
  const usableHeight =
    viewport.height - (viewport.width < 768 ? cardHeight + GAP + EDGE : EDGE * 2);
  const desiredTop = viewport.top + EDGE + Math.max(0, (usableHeight - target.height) / 2);
  return target.top - desiredTop;
}
