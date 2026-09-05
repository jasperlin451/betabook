import { describe, expect, it } from "vitest";

import { PRODUCT_TOURS } from "@/lib/product-tour";
import {
  findProductTour,
  getProductTourSteps,
  PRODUCT_TOUR_STEPS,
  productTourExitPath,
  productTourPath,
  type ProductTourStepDefinition,
} from "@/lib/product-tour-navigation";

describe("route-based tours", () => {
  it("gives every registered tour unique, addressable steps with stable targets", () => {
    for (const tour of PRODUCT_TOURS) {
      const steps = PRODUCT_TOUR_STEPS[tour.id];
      expect(steps.length).toBeGreaterThan(0);
      expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
      for (const step of steps) {
        expect(Number.isInteger(step.introducedInVersion)).toBe(true);
        expect(step.introducedInVersion).toBeGreaterThanOrEqual(1);
        expect(step.introducedInVersion).toBeLessThanOrEqual(tour.version);
        if (step.updatedInVersion !== undefined) {
          expect(Number.isInteger(step.updatedInVersion)).toBe(true);
          expect(step.updatedInVersion).toBeGreaterThan(step.introducedInVersion);
          expect(step.updatedInVersion).toBeLessThanOrEqual(tour.version);
        }
        expect(step.target).toMatch(/^[a-z][a-z0-9-]+$/);
        expect(productTourPath(tour.id, step.id)).toBe(`/tutorial/${tour.id}/${step.id}`);
      }
    }
  });

  it("keeps Account replay's return destination across steps", () => {
    for (const step of PRODUCT_TOUR_STEPS.journal) {
      expect(productTourPath("journal", step.id, "account")).toBe(
        `/tutorial/journal/${step.id}?from=account`,
      );
    }
    expect(productTourExitPath("owner", "account")).toBe("/account");
  });

  it("never uses an arbitrary return URL or sample ID for the user's destination", () => {
    expect(productTourExitPath("owner", "https://example.com")).toBe("/users/owner/journal");
    expect(productTourExitPath("owner", "//example.com")).toBe("/users/owner/journal");
    expect(productTourExitPath("owner", null)).toBe("/users/owner/journal");
    expect(productTourPath("journal", "missing")).toBe("/tutorial/journal/journal");
    expect(findProductTour("missing")).toBeUndefined();
  });

  it("keeps update mode on step links while Account always replays the full tour", () => {
    expect(productTourPath("journal", "sends", "journal", true)).toBe(
      "/tutorial/journal/sends?mode=updates",
    );
    expect(productTourPath("journal", "sends", "account", true)).toBe(
      "/tutorial/journal/sends?from=account",
    );
    expect(productTourPath("journal", "sends")).toBe("/tutorial/journal/sends");
  });
});

describe("lessons added after a user's acknowledged version", () => {
  const steps: ProductTourStepDefinition[] = [
    { ...PRODUCT_TOUR_STEPS.journal[0], id: "original", introducedInVersion: 1 },
    {
      ...PRODUCT_TOUR_STEPS.journal[1],
      id: "revised",
      introducedInVersion: 1,
      updatedInVersion: 3,
    },
    { ...PRODUCT_TOUR_STEPS.journal[2], id: "addition-v2", introducedInVersion: 2 },
    { ...PRODUCT_TOUR_STEPS.journal[3], id: "addition-v3", introducedInVersion: 3 },
  ];
  const ids = (version: number, acknowledgedVersion = 0) =>
    getProductTourSteps(steps, version, acknowledgedVersion).map((step) => step.id);

  it("includes the full tour for first-time users and explicit replay", () => {
    expect(ids(3)).toEqual(["original", "revised", "addition-v2", "addition-v3"]);
  });
  it("includes additions across missed releases and substantial revisions in catalog order", () => {
    expect(ids(3, 1)).toEqual(["revised", "addition-v2", "addition-v3"]);
    expect(ids(3, 2)).toEqual(["revised", "addition-v3"]);
  });
  it("does not offer unchanged lessons or already acknowledged versions", () => {
    expect(ids(3, 3)).toEqual([]);
    expect(ids(3, 4)).toEqual([]);
    expect(getProductTourSteps([steps[0]], 3, 1)).toEqual([]);
  });
  it("supports an update containing just one new lesson", () => {
    expect(getProductTourSteps([steps[0], steps[2]], 2, 1).map((step) => step.id)).toEqual([
      "addition-v2",
    ]);
  });
  it("does not offer steps before their introduction", () => {
    expect(ids(1)).toEqual(["original", "revised"]);
    expect(ids(2, 1)).toEqual(["addition-v2"]);
  });
});
