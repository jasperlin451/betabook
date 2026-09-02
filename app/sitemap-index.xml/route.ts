import { generateSitemaps } from "@/app/sitemap";
import { SITE_URL } from "@/lib/site";

// Computes shard count from live D1 counts (via generateSitemaps), so it
// can't be prerendered — same reason as app/sitemap.ts.
export const dynamic = "force-dynamic";

/** Sitemap index. `app/sitemap.ts` + `generateSitemaps` emits the numbered
 * shards at /sitemap/N.xml, but Next writes nothing that ties them together
 * — this does, and it's the URL to submit to Search Console. */
export async function GET() {
  const shards = await generateSitemaps();
  const entries = shards
    .map(({ id }) => `  <sitemap><loc>${SITE_URL}/sitemap/${id}.xml</loc></sitemap>`)
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
