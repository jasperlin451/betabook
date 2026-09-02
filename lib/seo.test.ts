import { describe, expect, it } from "vitest";

import {
  areaDescription,
  areaTitle,
  breadcrumbJsonLd,
  climbDescription,
  climbJsonLd,
  climbTitle,
  locationTrail,
  websiteJsonLd,
} from "./seo";

describe("climbTitle", () => {
  it("leads with the name, then native + converted grade, then the crag", () => {
    expect(climbTitle({ name: "Midnight Lightning", type: "boulder", grade: 9 }, "Camp 4")).toBe(
      "Midnight Lightning · V8 (7B) · Camp 4",
    );
  });

  it("drops the grade segment entirely when the climb is ungraded", () => {
    expect(climbTitle({ name: "Project", type: "sport", grade: null }, "The Cave")).toBe(
      "Project · The Cave",
    );
  });

  it("omits the parenthetical when the converted scale adds nothing", () => {
    // VB (index 0) converts to Font "3" — distinct, so it is shown.
    const t = climbTitle({ name: "Slab", type: "boulder", grade: 0 }, "Boulder Field");
    expect(t.startsWith("Slab · VB")).toBe(true);
  });
});

describe("climbDescription", () => {
  it("states discipline, grade, and location in one sentence", () => {
    expect(
      climbDescription(
        { name: "The Nose", type: "trad", grade: 19 },
        "El Capitan, Yosemite Valley",
      ),
    ).toBe(
      "The Nose is a 5.12b trad route in El Capitan, Yosemite Valley. Grades, ascent history, and community consensus on Betabook.",
    );
  });

  it("handles an ungraded climb and an empty trail", () => {
    expect(climbDescription({ name: "Unknown", type: "boulder", grade: null }, "")).toBe(
      "Unknown is a boulder problem. Grades, ascent history, and community consensus on Betabook.",
    );
  });
});

describe("areaTitle / areaDescription", () => {
  it("appends the parent area when there is one", () => {
    expect(areaTitle("Camp 4", "Yosemite Valley")).toBe("Camp 4 climbing · Yosemite Valley");
    expect(areaTitle("Yosemite", null)).toBe("Yosemite climbing");
  });

  it("folds the location trail into the description", () => {
    expect(areaDescription("Camp 4", "Yosemite Valley, Yosemite National Park")).toBe(
      "Climbing in Camp 4, Yosemite Valley, Yosemite National Park: routes and boulder problems with grades, logged ascents, and community ratings on Betabook.",
    );
  });
});

describe("locationTrail", () => {
  it("joins ancestor names nearest-last", () => {
    expect(locationTrail(["Yosemite", "Yosemite Valley", "Camp 4"])).toBe(
      "Yosemite, Yosemite Valley, Camp 4",
    );
    expect(locationTrail([])).toBe("");
  });

  it("keeps only the nearest `max` names", () => {
    const chain = ["North America", "United States", "California", "Yosemite", "Camp 4"];
    expect(locationTrail(chain)).toBe("California, Yosemite, Camp 4");
    expect(locationTrail(chain, 2)).toBe("Yosemite, Camp 4");
  });
});

describe("breadcrumbJsonLd", () => {
  it("emits absolute item URLs with 1-based positions", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Camp 4", path: "/areas/5" },
    ]);
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://betabook.ca/" },
      { "@type": "ListItem", position: 2, name: "Camp 4", item: "https://betabook.ca/areas/5" },
    ]);
  });
});

describe("websiteJsonLd", () => {
  it("wires the SearchAction at the home name query", () => {
    const ld = websiteJsonLd();
    expect(ld["@type"]).toBe("WebSite");
    expect((ld.potentialAction as Record<string, unknown>).target).toEqual({
      "@type": "EntryPoint",
      urlTemplate: "https://betabook.ca/?name={search_term_string}",
    });
  });
});

describe("climbJsonLd", () => {
  it("returns a BreadcrumbList followed by a WebPage, no rating markup", () => {
    const [crumbs, page] = climbJsonLd({
      name: "The Nose",
      path: "/climbs/1",
      description: "d",
      crumbs: [{ name: "Home", path: "/" }],
    });
    expect(crumbs["@type"]).toBe("BreadcrumbList");
    expect(page["@type"]).toBe("WebPage");
    expect(page.url).toBe("https://betabook.ca/climbs/1");
    expect(JSON.stringify(page)).not.toContain("AggregateRating");
  });
});
