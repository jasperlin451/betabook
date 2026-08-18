import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

export function createDb(d1: D1Database): Database {
  return drizzle(d1, { schema });
}

export async function getDb(): Promise<Database> {
  const { env } = await getCloudflareContext({ async: true });
  return createDb(env.DB);
}
