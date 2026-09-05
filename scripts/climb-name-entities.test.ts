import { describe, expect, it } from "vitest";

import { hasUnhandledEntity, repairClimbName } from "./climb-name-entities.ts";

describe("repairClimbName", () => {
  it("repairs the bare &amp found in production names", () => {
    expect(repairClimbName("Jekyll &amp Hyde")).toBe("Jekyll & Hyde");
    expect(repairClimbName("Huey Lewis &amp The News")).toBe("Huey Lewis & The News");
    expect(repairClimbName("60's &amp 70's")).toBe("60's & 70's");
    expect(repairClimbName("5.10 Until Lee &amp Jeff Do It")).toBe("5.10 Until Lee & Jeff Do It");
  });

  it("repairs the properly-terminated entity too", () => {
    expect(repairClimbName("Salt &amp; Pepper")).toBe("Salt & Pepper");
  });

  it("unwraps a name encoded twice", () => {
    expect(repairClimbName("Salt &amp;amp; Pepper")).toBe("Salt & Pepper");
  });

  it("stops unwrapping rather than eating an escaped entity forever", () => {
    expect(repairClimbName("&amp;amp;amp;amp;amp;")).toBe("&amp;amp;");
  });

  it("leaves a real ampersand and words that merely start with amp alone", () => {
    expect(repairClimbName("Cams #3 & #4")).toBe("Cams #3 & #4");
    expect(repairClimbName("Salt & Pepper")).toBe("Salt & Pepper");
    expect(repairClimbName("R&D")).toBe("R&D");
    expect(repairClimbName("&ampersand")).toBe("&ampersand");
    expect(repairClimbName("Amphitheatre")).toBe("Amphitheatre");
    expect(repairClimbName("Vamp")).toBe("Vamp");
  });

  it("repairs &amp at the very end of a name", () => {
    expect(repairClimbName("Fish &amp")).toBe("Fish &");
  });

  it("returns a name with no ampersand untouched", () => {
    expect(repairClimbName("Titanic")).toBe("Titanic");
    expect(repairClimbName("")).toBe("");
  });
});

describe("hasUnhandledEntity", () => {
  it("flags an entity shape this rule does not claim", () => {
    expect(hasUnhandledEntity("Caf&eacute; Wall")).toBe(true);
    expect(hasUnhandledEntity("I&rsquo;ve")).toBe(true);
    expect(hasUnhandledEntity("It&#39;s")).toBe(true);
    expect(hasUnhandledEntity("It&#x27;s")).toBe(true);
  });

  it("does not flag a name the repair fully cleans", () => {
    expect(hasUnhandledEntity("Jekyll &amp Hyde")).toBe(false);
    expect(hasUnhandledEntity("Salt &amp; Pepper")).toBe(false);
    expect(hasUnhandledEntity("Cams #3 & #4")).toBe(false);
    expect(hasUnhandledEntity("Titanic")).toBe(false);
  });
});
