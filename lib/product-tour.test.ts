import { describe, expect, it } from "vitest";

import {
  PRODUCT_TOURS,
  shouldOfferProductTour,
  validateProductTourUpdate,
} from "@/lib/product-tour";

const tour = PRODUCT_TOURS[0];

describe("versioned product tour eligibility", () => {
  it("offers a tour to an account without progress", () => {
    expect(shouldOfferProductTour(tour, [])).toBe(true);
  });
  it.each(["dismissed", "completed"] as const)("hides a %s current version", (status) => {
    expect(shouldOfferProductTour(tour, [{ tourId: tour.id, version: tour.version, status }])).toBe(
      false,
    );
  });
  it("offers a new component showcase independently of the journal tour", () => {
    const progress = [{ tourId: tour.id, version: tour.version, status: "completed" as const }];
    expect(shouldOfferProductTour({ id: "new-component", version: 1 }, progress)).toBe(true);
    expect(shouldOfferProductTour(tour, progress)).toBe(false);
  });
  it("offers an updated tour but never an older version", () => {
    const progress = [{ tourId: tour.id, version: 2, status: "completed" as const }];
    expect(shouldOfferProductTour({ id: tour.id, version: 3 }, progress)).toBe(true);
    expect(shouldOfferProductTour(tour, progress)).toBe(false);
  });
  it("rejects unknown tours and stale client versions", () => {
    expect(() => validateProductTourUpdate("unknown", 1, "completed")).toThrow("tour has changed");
    expect(() => validateProductTourUpdate(tour.id, 0, "completed")).toThrow("tour has changed");
    expect(() => validateProductTourUpdate(tour.id, tour.version, "pending")).toThrow(
      "Invalid product tour status",
    );
  });
});
