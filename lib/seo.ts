import type { Metadata } from "next";

import { formatGrade, type ClimbType } from "@/lib/grades";
import { OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";

/** Full per-page metadata fragment for an indexable content page.
 *
 * `openGraph` and `twitter` are OVERWRITTEN, not merged, by the nearest
 * segment that sets them (Next metadata merging rules), so a page that wants
 * a per-page title has to re-supply `siteName`, `twitter.card`, and —
 * verified — the OG image too: returning any `openGraph` object drops the
 * inherited root `opengraph-image` file. This is the one place that list
 * lives. */
export function pageMetadata(opts: {
  title: string;
  description: string;
  /** Site-relative, e.g. `/climbs/42` — resolved against `metadataBase`. */
  path: string;
  ogType?: "website" | "article";
}): Metadata {
  const { title, description, path, ogType = "website" } = opts;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      title,
      description,
      url: path,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}

/** The noun a climb of each discipline is called in running prose. */
const DISCIPLINE_NOUN: Record<ClimbType, string> = {
  boulder: "boulder problem",
  sport: "sport route",
  trad: "trad route",
};

/** Font (boulder) / French (rope) grade for a climb, or null when the climb
 * is ungraded or the converted table has no entry — the native scale (Hueco
 * / YDS) is always shown, the converted one only as a parenthetical when it
 * adds something. */
function convertedGrade(type: ClimbType, grade: number | null): string | null {
  if (grade == null) return null;
  const converted = formatGrade(type, grade, type === "boulder" ? "font" : "french");
  const native = formatGrade(type, grade);
  return converted === "—" || converted === native ? null : converted;
}

/** The `max` nearest names joined nearest-last into a short location trail
 * for a meta description, e.g. "Squamish, Grand Wall Boulders, Superfly".
 * Capped because a full root-to-crag chain ("North America, Canada, …")
 * pushes the useful part of the sentence past where search engines truncate.
 * Breadcrumb and `containedInPlace` structured data still use the full
 * chain. */
export function locationTrail(names: string[], max = 3): string {
  return names.slice(-max).join(", ");
}

type ClimbFacts = { name: string; type: ClimbType; grade: number | null };

/** `<title>` for a climb page (the layout appends " · Betabook"). Leads with
 * the name, then the grade in both scales, then the crag — the phrases people
 * actually search. Discipline is left to the description; the grade format
 * already signals it (V-scale vs 5.-scale). */
export function climbTitle(climb: ClimbFacts, areaName: string): string {
  const converted = convertedGrade(climb.type, climb.grade);
  const gradePart =
    climb.grade == null
      ? ""
      : converted
        ? ` · ${formatGrade(climb.type, climb.grade)} (${converted})`
        : ` · ${formatGrade(climb.type, climb.grade)}`;
  return `${climb.name}${gradePart} · ${areaName}`;
}

/** `<meta name="description">` for a climb page — one unique factual sentence
 * built from structured data, so even a climb with no written description
 * isn't a near-empty page to a crawler. */
export function climbDescription(climb: ClimbFacts, trail: string): string {
  const grade = formatGrade(climb.type, climb.grade);
  const gradeClause =
    climb.grade == null ? DISCIPLINE_NOUN[climb.type] : `${grade} ${DISCIPLINE_NOUN[climb.type]}`;
  const where = trail ? ` in ${trail}` : "";
  return `${climb.name} is a ${gradeClause}${where}. Grades, ascent history, and community consensus on ${SITE_NAME}.`;
}

/** `<title>` for an area page. */
export function areaTitle(name: string, parentName: string | null): string {
  return parentName ? `${name} climbing · ${parentName}` : `${name} climbing`;
}

/** `<meta name="description">` for an area page. */
export function areaDescription(name: string, trail: string): string {
  const where = trail ? `${name}, ${trail}` : name;
  return `Climbing in ${where}: routes and boulder problems with grades, logged ascents, and community ratings on ${SITE_NAME}.`;
}

type Crumb = { name: string; path: string };

/** schema.org BreadcrumbList — the one structured-data type with broad,
 * low-risk rich-result support here. `path` is site-relative. */
export function breadcrumbJsonLd(crumbs: Crumb[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path}`,
    })),
  };
}

/** Sitewide WebSite node with a SearchAction, so Google can offer a
 * sitelinks search box that targets the home search. */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/?name={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** Nests ancestor names (root-first input) into a schema.org
 * `containedInPlace` chain and returns the nearest parent — that Place's
 * own `containedInPlace` is its parent, and so on up to the root. */
function containedInPlace(ancestorNames: string[]): Record<string, unknown> | undefined {
  let place: Record<string, unknown> | undefined;
  for (const name of ancestorNames) {
    place = { "@type": "Place", name, ...(place ? { containedInPlace: place } : {}) };
  }
  return place;
}

/** BreadcrumbList + a Place for an area page. */
export function areaJsonLd(args: {
  name: string;
  path: string;
  description: string;
  crumbs: Crumb[];
  ancestorNames: string[];
}): Record<string, unknown>[] {
  const parent = containedInPlace(args.ancestorNames);
  return [
    breadcrumbJsonLd(args.crumbs),
    {
      "@context": "https://schema.org",
      "@type": "Place",
      name: args.name,
      url: `${SITE_URL}${args.path}`,
      description: args.description,
      ...(parent ? { containedInPlace: parent } : {}),
    },
  ];
}

/** BreadcrumbList + a WebPage for a climb page. No AggregateRating/Review
 * markup: Google scopes rating rich results to specific types (a climb is
 * none of them) and self-serving rating markup risks a manual action. */
export function climbJsonLd(args: {
  name: string;
  path: string;
  description: string;
  crumbs: Crumb[];
}): Record<string, unknown>[] {
  return [
    breadcrumbJsonLd(args.crumbs),
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: args.name,
      url: `${SITE_URL}${args.path}`,
      description: args.description,
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    },
  ];
}
