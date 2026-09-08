import { env } from "cloudflare:test";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

import AreaPage, { generateMetadata as areaMetadata } from "@/app/areas/[id]/[[...slug]]/page";
import { PublicAreaPage } from "@/app/areas/[id]/[[...slug]]/public-area-page";
import ClimbPage, { generateMetadata as climbMetadata } from "@/app/climbs/[id]/[[...slug]]/page";
import UserPage, { generateMetadata as userMetadata } from "@/app/users/[id]/page";
import { createDb } from "@/db/client";
import { getPublicArea } from "@/db/queries/public-catalog";
import { climbs } from "@/db/schema";
import { seedFixtureTree, seedFixtureUser } from "@/test/fixtures";
import { resetDb } from "@/test/reset-db";

vi.mock("@/lib/session", () => ({ getSession: async () => null }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  permanentRedirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  useRouter: () => ({ push: () => {} }),
  usePathname: () => "/users/hidden",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({ default: () => null }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/db/client", async (original) => {
  const actual = await original<typeof import("@/db/client")>();
  const { env } = await import("cloudflare:test");
  return { ...actual, getDb: async () => actual.createDb(env.DB) };
});
const db = createDb(env.DB);
beforeEach(async () => {
  await resetDb(db);
  await seedFixtureTree(db);
  await db.update(climbs).set({ description: "Restricted route description sentinel" });
  await seedFixtureUser(db, { id: "hidden", name: "Restricted identity sentinel" });
});
const areaProps = {
  params: Promise.resolve({ id: "1", slug: ["test-crag"] }),
  searchParams: Promise.resolve({}),
};
const climbProps = {
  params: Promise.resolve({ id: "1", slug: ["test-highball"] }),
  searchParams: Promise.resolve({}),
};
it("renders the public area from name-only records with no descriptions or grade data in props", async () => {
  const page = await AreaPage(areaProps);
  expect(page.type).toBe(PublicAreaPage);
  const area = await getPublicArea(db, 1);
  expect(area).toEqual({ id: 1, name: "Test Crag", parentId: null });
  const content = await PublicAreaPage({ area: area!, search: {} });
  const serialized = JSON.stringify(content);
  expect(serialized).toContain("Test Highball");
  expect(serialized).toContain("Test Boulders");
  expect(serialized).not.toContain("A test crag.");
  expect(serialized).not.toContain('"grade":');
  expect(serialized).not.toContain('"sendStats":');
  expect(serialized).not.toContain('"histogram":');
});
it("renders a public route name, breadcrumbs and callout without member facts or metadata", async () => {
  const page = await ClimbPage(climbProps);
  const serialized = JSON.stringify(page);
  expect(serialized).toContain("Test Highball");
  expect(serialized).not.toContain("Restricted route description sentinel");
  expect(serialized).not.toContain('"grade":');
  const html = renderToStaticMarkup(page);
  expect(html).toContain("Sign in or sign up to see all the content.");
  expect(html).not.toContain("V4");
  expect(await climbMetadata(climbProps)).toMatchObject({
    title: "Test Highball · Test Highball Alcove",
    alternates: { canonical: "/climbs/1/test-highball" },
  });
  expect(JSON.stringify(await climbMetadata(climbProps))).not.toContain("V4");
  expect(JSON.stringify(await areaMetadata(areaProps))).not.toContain("A test crag.");
});
it("does not reveal whether a profile exists in the page or metadata", async () => {
  for (const id of ["hidden", "missing"]) {
    const props = { params: Promise.resolve({ id }), searchParams: Promise.resolve({}) };
    expect(await userMetadata(props)).toEqual({
      title: "Member content",
      robots: { index: false },
    });
    const html = renderToStaticMarkup(await UserPage(props));
    expect(html).toContain("Sign in or sign up to see all the content.");
    expect(html).not.toContain("Restricted identity sentinel");
  }
});
it("preserves public canonical redirects and missing-entity errors", async () => {
  await expect(
    ClimbPage({ ...climbProps, params: Promise.resolve({ id: "1", slug: ["stale"] }) }),
  ).rejects.toThrow("REDIRECT:/climbs/1/test-highball");
  await expect(AreaPage({ ...areaProps, params: Promise.resolve({ id: "999" }) })).rejects.toThrow(
    "NOT_FOUND",
  );
});
