import { and, desc, eq, getTableColumns } from "drizzle-orm";
import type { Database } from "@/db/client";
import { sends, climbs, user } from "@/db/schema";
import type { ClimbType } from "@/lib/grades";

export type Send = typeof sends.$inferSelect;
export type SendWithUserName = Send & { userName: string };
export type SendWithClimb = Send & {
  climbName: string;
  climbType: ClimbType;
  climbGrade: number | null;
};

export async function getUserSendForClimb(
  db: Database,
  userId: string,
  climbId: number,
): Promise<Send | undefined> {
  return db
    .select()
    .from(sends)
    .where(and(eq(sends.userId, userId), eq(sends.climbId, climbId)))
    .get();
}

export async function getSendsForClimb(db: Database, climbId: number): Promise<SendWithUserName[]> {
  return db
    .select({ ...getTableColumns(sends), userName: user.name })
    .from(sends)
    .innerJoin(user, eq(sends.userId, user.id))
    .where(eq(sends.climbId, climbId))
    .orderBy(desc(sends.dateSent));
}

export async function getSendsForUser(db: Database, userId: string): Promise<SendWithClimb[]> {
  return db
    .select({
      ...getTableColumns(sends),
      climbName: climbs.name,
      climbType: climbs.type,
      climbGrade: climbs.grade,
    })
    .from(sends)
    .innerJoin(climbs, eq(sends.climbId, climbs.id))
    .where(eq(sends.userId, userId))
    .orderBy(desc(sends.dateSent));
}
