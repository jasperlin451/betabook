import { describe, expect, it } from "vitest";

import { positionTourCard, tourTargetScrollDelta } from "@/lib/product-tour-position";

describe("tour callout placement", () => {
  it("uses the space beside a desktop target without covering it", () => {
    const target = { left: 100, top: 200, width: 600, height: 80 };
    const placed = positionTourCard(target, { width: 1440, height: 900, top: 0 }, 250);
    expect(placed.left).toBeGreaterThan(target.left + target.width);
    expect(placed.top).toBe(target.top);
    expect(placed.left + placed.width).toBeLessThanOrEqual(1428);
  });

  it("places the card to the left of a control at the right edge", () => {
    const placed = positionTourCard(
      { left: 1300, top: 100, width: 80, height: 40 },
      { width: 1440, height: 900, top: 0 },
      250,
    );
    expect(placed.left + placed.width).toBeLessThan(1300);
  });

  it.each([
    { width: 390, height: 844, top: 0 },
    { width: 320, height: 568, top: 0 },
    { width: 390, height: 400, top: 100 },
  ])("keeps the mobile card above the keyboard in $width × $height", (viewport) => {
    const placed = positionTourCard({ left: 20, top: 200, width: 270, height: 80 }, viewport, 220);
    expect(placed.left).toBe(12);
    expect(placed.left + placed.width).toBe(viewport.width - 12);
    expect(placed.top + 220).toBe(viewport.top + viewport.height - 12);
  });

  it("falls back to a reachable card when a target is absent", () => {
    const placed = positionTourCard(null, { width: 1024, height: 600, top: 0 }, 250);
    expect(placed.top).toBe(338);
    expect(placed.left).toBeGreaterThan(0);
    expect(placed.left + placed.width).toBeLessThan(1024);
  });

  it("scrolls the target into the space above the mobile card", () => {
    const target = { left: 16, top: 1000, width: 350, height: 100 };
    const viewport = { width: 390, height: 844, top: 0 };
    const delta = tourTargetScrollDelta(target, viewport, 250);
    const placed = positionTourCard(target, viewport, 250);
    expect(delta).toBeGreaterThan(0);
    expect(target.top - delta).toBeGreaterThan(0);
    expect(target.top - delta + target.height).toBeLessThan(placed.top);
  });
});
