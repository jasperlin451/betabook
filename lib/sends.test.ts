import { describe, expect, it } from "vitest";
import { validateSendInput, type RawSendInput } from "./sends";

const TODAY = "2026-08-19";

function raw(overrides: Partial<RawSendInput> = {}): RawSendInput {
  return {
    ascentStyle: "redpoint",
    dateSent: TODAY,
    comment: null,
    rating: null,
    suggestedGrade: "5",
    ...overrides,
  };
}

describe("validateSendInput", () => {
  it("accepts a minimal valid input for a boulder climb", () => {
    const result = validateSendInput("boulder", raw(), TODAY);
    expect(result).toEqual({
      ascentStyle: "redpoint",
      dateSent: TODAY,
      comment: null,
      rating: null,
      suggestedGrade: 5,
    });
  });

  it("accepts each ascent style", () => {
    for (const ascentStyle of ["redpoint", "flash", "onsight"]) {
      expect(validateSendInput("sport", raw({ ascentStyle }), TODAY).ascentStyle).toBe(
        ascentStyle,
      );
    }
  });

  it("rejects an invalid ascent style", () => {
    expect(() =>
      validateSendInput("boulder", raw({ ascentStyle: "attempt" }), TODAY),
    ).toThrow("Invalid ascent style");
  });

  it("rejects a malformed send date", () => {
    expect(() =>
      validateSendInput("boulder", raw({ dateSent: "08/19/2026" }), TODAY),
    ).toThrow("Invalid send date");
  });

  it("rejects a send date in the future", () => {
    expect(() =>
      validateSendInput("boulder", raw({ dateSent: "2026-08-20" }), TODAY),
    ).toThrow("can't be in the future");
  });

  it("accepts a send date equal to today", () => {
    expect(validateSendInput("boulder", raw({ dateSent: TODAY }), TODAY).dateSent).toBe(TODAY);
  });

  it("accepts a null send date", () => {
    expect(validateSendInput("boulder", raw({ dateSent: null }), TODAY).dateSent).toBeNull();
  });

  it("treats a blank send date as null", () => {
    expect(validateSendInput("boulder", raw({ dateSent: "" }), TODAY).dateSent).toBeNull();
    expect(validateSendInput("boulder", raw({ dateSent: "   " }), TODAY).dateSent).toBeNull();
  });

  it("trims a comment and accepts it under the length limit", () => {
    const result = validateSendInput("boulder", raw({ comment: "  Great climb!  " }), TODAY);
    expect(result.comment).toBe("Great climb!");
  });

  it("treats a blank comment as null", () => {
    expect(validateSendInput("boulder", raw({ comment: "   " }), TODAY).comment).toBeNull();
  });

  it("rejects a comment over the length limit", () => {
    expect(() =>
      validateSendInput("boulder", raw({ comment: "a".repeat(281) }), TODAY),
    ).toThrow("280 characters or fewer");
  });

  it("accepts a null rating (abstain)", () => {
    expect(validateSendInput("boulder", raw({ rating: null }), TODAY).rating).toBeNull();
  });

  it("accepts ratings 1 through 5", () => {
    for (let rating = 1; rating <= 5; rating++) {
      expect(validateSendInput("boulder", raw({ rating: String(rating) }), TODAY).rating).toBe(
        rating,
      );
    }
  });

  it("rejects an out-of-range rating", () => {
    expect(() => validateSendInput("boulder", raw({ rating: "0" }), TODAY)).toThrow(
      "Rating must be between 1 and 5",
    );
    expect(() => validateSendInput("boulder", raw({ rating: "6" }), TODAY)).toThrow(
      "Rating must be between 1 and 5",
    );
  });

  it("rejects a non-integer rating", () => {
    expect(() => validateSendInput("boulder", raw({ rating: "3.5" }), TODAY)).toThrow(
      "Rating must be between 1 and 5",
    );
  });

  it("rejects a missing suggested grade", () => {
    expect(() => validateSendInput("boulder", raw({ suggestedGrade: null }), TODAY)).toThrow(
      "Suggested grade is required",
    );
    expect(() => validateSendInput("boulder", raw({ suggestedGrade: "" }), TODAY)).toThrow(
      "Suggested grade is required",
    );
  });

  it("accepts a suggested grade within the climb type's native scale", () => {
    expect(
      validateSendInput("boulder", raw({ suggestedGrade: "5" }), TODAY).suggestedGrade,
    ).toBe(5);
    expect(
      validateSendInput("sport", raw({ suggestedGrade: "10" }), TODAY).suggestedGrade,
    ).toBe(10);
  });

  it("rejects a suggested grade out of range for the climb type", () => {
    expect(() =>
      validateSendInput("boulder", raw({ suggestedGrade: "999" }), TODAY),
    ).toThrow("Invalid suggested grade");
    expect(() =>
      validateSendInput("boulder", raw({ suggestedGrade: "-1" }), TODAY),
    ).toThrow("Invalid suggested grade");
  });

  it("rejects a non-integer suggested grade", () => {
    expect(() =>
      validateSendInput("boulder", raw({ suggestedGrade: "2.5" }), TODAY),
    ).toThrow("Invalid suggested grade");
  });
});
