import { describe, expect, it } from "vitest";

import { areaHref, climbHref, slugify } from "./slug";

describe("slugify", () => {
  it("lowercases, hyphenates words, and trims", () => {
    expect(slugify("Midnight Lightning")).toBe("midnight-lightning");
    expect(slugify("  The  Nose  ")).toBe("the-nose");
  });

  it("drops apostrophes so the word stays whole", () => {
    expect(slugify("Don't Get Greedy")).toBe("dont-get-greedy");
    expect(slugify("O’Kelley’s Arete")).toBe("okelleys-arete");
  });

  it("flattens accents to ASCII", () => {
    expect(slugify("Café Crème")).toBe("cafe-creme");
    expect(slugify("Böhmischer Traum")).toBe("bohmischer-traum");
  });

  it("collapses punctuation and symbols to single hyphens", () => {
    expect(slugify("5.12a / V8 — project!")).toBe("5-12a-v8-project");
  });

  it("returns empty when nothing slug-able survives", () => {
    expect(slugify("上高地")).toBe("");
    expect(slugify("!!!")).toBe("");
  });

  it("caps length and never leaves a trailing hyphen", () => {
    const cut = slugify("a".repeat(79) + " tail");
    expect(cut).toBe("a".repeat(79));
    expect(cut.length).toBeLessThanOrEqual(80);
  });
});

describe("climbHref / areaHref", () => {
  it("builds id + slug paths", () => {
    expect(climbHref(141187, "Midnight Lightning")).toBe("/climbs/141187/midnight-lightning");
    expect(areaHref(3611, "Squamish")).toBe("/areas/3611/squamish");
  });

  it("omits the slug segment when the name yields nothing", () => {
    expect(climbHref(42, "上")).toBe("/climbs/42");
    expect(areaHref(7, "???")).toBe("/areas/7");
  });
});
