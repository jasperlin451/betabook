import { describe, expect, it } from "vitest";

import { PRODUCT_TOURS } from "@/lib/product-tour";
import {
  findProductTour,
  PRODUCT_TOUR_STEPS,
  productTourExitPath,
  productTourPath,
} from "@/lib/product-tour-navigation";

describe("route-based tours", () => {
  it("gives every registered tour unique, addressable steps with stable targets", () => {
    for (const tour of PRODUCT_TOURS) {
      const steps = PRODUCT_TOUR_STEPS[tour.id];
      expect(steps.length).toBeGreaterThan(0);
      expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
      for (const step of steps) {
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
});
