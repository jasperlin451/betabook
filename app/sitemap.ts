import type { MetadataRoute } from "next";
import { cache } from "react";

import { getDb } from "@/db/client";
import { countAreas, countClimbs, getAreaIdsPage, getClimbIdsPage } from "@/db/queries";
import { SITE_URL } from "@/lib/site";

// Google caps a sitemap at 50,000 URLs; stay under with headroom.
const SHARD_SIZE = 40_000;

// The build has no D1 binding, so this can't be prerendered — render each
// shard on request. Crawlers hit it rarely; two `SELECT id` scans per hit is
// fine. Add ISR here if that ever stops being true.
export const dynamic = "force-dynamic";

// "" (not "/") so the root entry is `https://betabook.ca`, matching the
// canonical link the home page renders.
const STATIC_PATHS = ["", "/about", "/contact"];

const counts = cache(async () => {
  const db = await getDb();
  const [areas, climbs] = await Promise.all([countAreas(db), countClimbs(db)]);
  return { areas, climbs };
});

/** Shard layout: area shards first (static paths ride in shard 0), then climb
 * shards. `sitemap()` reverses the same arithmetic to fetch its own slice. */
export async function generateSitemaps() {
  const { areas, climbs } = await counts();
  const areaShards = Math.max(1, Math.ceil(areas / SHARD_SIZE));
  const climbShards = Math.ceil(climbs / SHARD_SIZE);
  return Array.from({ length: areaShards + climbShards }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const shard = Number(await id);
  if (!Number.isInteger(shard) || shard < 0) return [];

  const db = await getDb();
  const { areas } = await counts();
  const areaShards = Math.max(1, Math.ceil(areas / SHARD_SIZE));

  if (shard < areaShards) {
    const ids = await getAreaIdsPage(db, SHARD_SIZE, shard * SHARD_SIZE);
    const areaEntries = ids.map((areaId) => ({ url: `${SITE_URL}/areas/${areaId}` }));
    if (shard !== 0) return areaEntries;
    return [...STATIC_PATHS.map((path) => ({ url: `${SITE_URL}${path}` })), ...areaEntries];
  }

  const ids = await getClimbIdsPage(db, SHARD_SIZE, (shard - areaShards) * SHARD_SIZE);
  return ids.map((climbId) => ({ url: `${SITE_URL}/climbs/${climbId}` }));
}
