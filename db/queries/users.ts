import { eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import { user } from "@/db/schema";

export async function getUser(db: Database, id: string) {
  return db.select().from(user).where(eq(user.id, id)).get();
}
