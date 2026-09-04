import { and, eq, exists, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { refresh, revalidatePath } from "next/cache";

import type { Database } from "@/db/client";
import {
  getArea,
  getClimb,
  getSubareas,
  hasClimbsInArea,
  type Area,
  type Climb,
} from "@/db/queries";
import {
  adminAreaScopes,
  areas,
  changeRequests,
  climbs,
  sends,
  CHANGE_REQUEST_TYPES,
} from "@/db/schema";
import { ActionError } from "@/lib/action-result";
import type { AreaInput } from "@/lib/areas";
import type { ClimbInput } from "@/lib/climbs";
import { isAdmin } from "@/lib/session";

export type ChangeRequestType = (typeof CHANGE_REQUEST_TYPES)[number];

/** The success value of every gated action — lets the UI tell "your edit
 * went live" apart from "an admin needs to approve it first". */
export type GatedActionResult = { status: "applied" | "pending" };

/** The validated, type-specific fields stored as `changeRequests.payload`
 * JSON. Already run through validateAreaInput/validateClimbInput by the
 * submitting action, so approving a request never re-validates user input —
 * only re-checks that the operation is still legal (entity still exists,
 * etc). */
export type ChangeRequestPayload = {
  area_edit: AreaInput;
  area_delete: Record<string, never>;
  area_reparent: { newParentId: number };
  climb_edit: ClimbInput;
  climb_delete: Record<string, never>;
  climb_move: { newAreaId: number };
  // `type`/`areaId` are deliberately excluded: type must already match (see
  // assertClimbMergeable) and the target's area always wins a merge.
  climb_merge: {
    targetClimbId: number;
    overrides?: Partial<Pick<ClimbInput, "name" | "grade" | "description">>;
  };
};

/** Queues a change instead of applying it — the non-admin half of every
 * gated action's `isAdmin(session) ? applyX(...) : submitChangeRequest(...)`
 * branch. Returns the new request's id. */
export async function submitChangeRequest<T extends ChangeRequestType>(
  db: Database,
  type: T,
  entityId: number,
  requestedBy: string,
  payload: ChangeRequestPayload[T],
): Promise<number> {
  const [{ id }] = await db
    .insert(changeRequests)
    .values({ type, entityId, requestedBy, payload: JSON.stringify(payload) })
    .returning({ id: changeRequests.id });
  return id;
}

// --- Apply logic -----------------------------------------------------------
//
// One function per gated operation, shared between "an admin does it right
// now" and "an admin approves a queued request later" — both paths need the
// exact same mutation + revalidation, and re-checking business rules here
// (not just at submission) matters because state can drift between when a
// non-admin submits a request and when it's actually applied.
//
// Full edit (name/discipline/grade) and delete are moderation-exclusive:
// updateArea/updateClimb (actions/areas.ts, actions/climbs.ts) only ever
// touch description, unrestricted for every signed-in user, and there is no
// direct delete at all — this is the only path to either.

export async function applyAreaEdit(db: Database, areaId: number, input: AreaInput): Promise<void> {
  const existing = await getArea(db, areaId);
  if (!existing) throw new ActionError("Area not found");

  await db.update(areas).set(input).where(eq(areas.id, areaId));

  revalidatePath(`/areas/${areaId}`);
  if (existing.parentId != null) revalidatePath(`/areas/${existing.parentId}`);
  revalidatePath("/");
  refresh();
}

/** Throws the same business-rule messages the old, unrestricted deleteArea
 * used to, without mutating anything. Used both to give a non-admin
 * immediate feedback before queuing a request that could never succeed, and
 * inside applyAreaDelete itself. */
export async function assertAreaDeletable(db: Database, areaId: number): Promise<Area> {
  const existing = await getArea(db, areaId);
  if (!existing) throw new ActionError("Area not found");
  const subareas = await getSubareas(db, areaId);
  if (subareas.length > 0) throw new ActionError("Can't delete an area with sub-areas");
  if (await hasClimbsInArea(db, areaId)) throw new ActionError("Can't delete an area with climbs");
  return existing;
}

export async function applyAreaDelete(db: Database, areaId: number): Promise<void> {
  const existing = await assertAreaDeletable(db, areaId);

  await db.delete(areas).where(eq(areas.id, areaId));

  revalidatePath(`/areas/${areaId}`);
  if (existing.parentId != null) revalidatePath(`/areas/${existing.parentId}`);
  revalidatePath("/");
  refresh();
}

/** True when `candidateId` is `ofId` itself or a descendant of it — walked by
 * following `candidateId`'s ancestor chain upward (bounded by tree depth)
 * rather than enumerating `ofId`'s descendants (which can fan out over an
 * entire subtree). Same recursive-CTE shape as resolveSubareaScope in
 * db/queries/areas.ts. Used to give a friendly error before the database's
 * own cycle-guard trigger (0017_area_cycle_guard.sql) would otherwise reject
 * the update outright. */
async function isAreaOrDescendant(
  db: Database,
  candidateId: number,
  ofId: number,
): Promise<boolean> {
  if (candidateId === ofId) return true;
  const [row] = await db.all<{ found: number }>(sql`
    WITH RECURSIVE chain(id) AS (
      SELECT parent_id FROM areas WHERE id = ${candidateId}
      UNION ALL
      SELECT areas.parent_id FROM chain JOIN areas ON areas.id = chain.id
      WHERE areas.parent_id IS NOT NULL
    )
    SELECT 1 AS found FROM chain WHERE id = ${ofId} LIMIT 1
  `);
  return Boolean(row);
}

/** The actual bypass gate every gated action checks — not just `isAdmin`'s
 * coarse role check. An admin with no rows in `adminAreaScopes` at all
 * bypasses nothing; a row covers its whole subtree, walked the same way
 * `isAreaOrDescendant` does for the reparent cycle-guard. `areaId` is always
 * the entity's *current* area (a climb's own `areaId`, or the area itself
 * for an area operation) — a merge is gated on the source climb's area,
 * since that's the one being deleted into another. */
export async function isAdminForArea(
  db: Database,
  session: { user: { id: string; role?: string | null } },
  areaId: number,
): Promise<boolean> {
  if (!isAdmin(session)) return false;

  const managed = await db
    .select({ areaId: adminAreaScopes.areaId })
    .from(adminAreaScopes)
    .where(eq(adminAreaScopes.userId, session.user.id));

  for (const { areaId: managedAreaId } of managed) {
    if (await isAreaOrDescendant(db, areaId, managedAreaId)) return true;
  }
  return false;
}

/** Throws without mutating anything — used both to give a non-admin
 * immediate feedback before queuing a request that could never succeed, and
 * inside applyAreaReparent itself. */
export async function assertAreaReparentable(
  db: Database,
  areaId: number,
  newParentId: number,
): Promise<Area> {
  const existing = await getArea(db, areaId);
  if (!existing) throw new ActionError("Area not found");
  if (!(await getArea(db, newParentId))) throw new ActionError("Parent area not found");
  if (await isAreaOrDescendant(db, newParentId, areaId)) {
    throw new ActionError("Can't move an area under itself or one of its own sub-areas");
  }
  return existing;
}

export async function applyAreaReparent(
  db: Database,
  areaId: number,
  newParentId: number,
): Promise<void> {
  const existing = await assertAreaReparentable(db, areaId, newParentId);

  await db.update(areas).set({ parentId: newParentId }).where(eq(areas.id, areaId));

  revalidatePath(`/areas/${areaId}`);
  revalidatePath(`/areas/${newParentId}`);
  if (existing.parentId != null) revalidatePath(`/areas/${existing.parentId}`);
  revalidatePath("/");
  refresh();
}

export async function assertClimbMovable(
  db: Database,
  climbId: number,
  newAreaId: number,
): Promise<Climb> {
  const existing = await getClimb(db, climbId);
  if (!existing) throw new ActionError("Climb not found");
  if (!(await getArea(db, newAreaId))) throw new ActionError("Area not found");
  return existing;
}

export async function applyClimbMove(
  db: Database,
  climbId: number,
  newAreaId: number,
): Promise<void> {
  const existing = await assertClimbMovable(db, climbId, newAreaId);

  await db.update(climbs).set({ areaId: newAreaId }).where(eq(climbs.id, climbId));

  revalidatePath(`/climbs/${climbId}`);
  revalidatePath(`/areas/${newAreaId}`);
  revalidatePath(`/areas/${existing.areaId}`);
  revalidatePath("/");
  refresh();
}

export async function applyClimbEdit(
  db: Database,
  climbId: number,
  input: ClimbInput,
): Promise<void> {
  const existing = await getClimb(db, climbId);
  if (!existing) throw new ActionError("Climb not found");

  const condition =
    input.type === existing.type
      ? eq(climbs.id, climbId)
      : and(
          eq(climbs.id, climbId),
          notExists(db.select({ id: sends.id }).from(sends).where(eq(sends.climbId, climbs.id))),
        );
  const updated = await db
    .update(climbs)
    .set(input)
    .where(condition)
    .returning({ id: climbs.id })
    .get();
  if (!updated) {
    if (!(await getClimb(db, climbId))) throw new ActionError("Climb not found");
    throw new ActionError("Can't change discipline once a climb has logged sends");
  }

  revalidatePath(`/climbs/${climbId}`);
  revalidatePath(`/areas/${existing.areaId}`);
  revalidatePath("/");
  refresh();
}

/** Advisory only — `sendCount` is a denormalized aggregate that can drift
 * under a race with a concurrent send being logged. applyClimbDelete
 * re-checks authoritatively (a live `notExists(sends)`) whenever the
 * deletion is actually applied, whether that's now or on later approval; this
 * just avoids queuing a request that's already doomed. */
export async function assertClimbDeletable(db: Database, climbId: number): Promise<Climb> {
  const existing = await getClimb(db, climbId);
  if (!existing) throw new ActionError("Climb not found");
  if (existing.sendCount > 0) throw new ActionError("Can't delete a climb with logged sends");
  return existing;
}

export async function applyClimbDelete(db: Database, climbId: number): Promise<void> {
  const deleted = await db
    .delete(climbs)
    .where(
      and(
        eq(climbs.id, climbId),
        notExists(db.select({ id: sends.id }).from(sends).where(eq(sends.climbId, climbs.id))),
      ),
    )
    .returning({ areaId: climbs.areaId })
    .get();

  if (!deleted) {
    if (!(await getClimb(db, climbId))) throw new ActionError("Climb not found");
    throw new ActionError("Can't delete a climb with logged sends");
  }

  revalidatePath(`/areas/${deleted.areaId}`);
  revalidatePath("/");
  refresh();
}

/** Placed between two merged sends' comments — see applyClimbMerge. */
export const MERGE_COMMENT_SEPARATOR = "\n---------\n";

/** Throws without mutating anything — used both to give a non-admin
 * immediate feedback before queuing a request that could never succeed, and
 * inside applyClimbMerge itself. Discipline mismatch is a hard block rather
 * than a mergeable difference: `sends.suggestedGrade` is in the same ordinal
 * space as `climbs.grade` but scoped by `climb.type`, so a boulder/sport pair
 * can't be true duplicates — that's a mis-categorization, not a duplicate. */
export async function assertClimbMergeable(
  db: Database,
  sourceClimbId: number,
  targetClimbId: number,
): Promise<{ source: Climb; target: Climb }> {
  if (sourceClimbId === targetClimbId) throw new ActionError("Can't merge a climb into itself");
  const source = await getClimb(db, sourceClimbId);
  if (!source) throw new ActionError("Climb not found");
  const target = await getClimb(db, targetClimbId);
  if (!target) throw new ActionError("Target climb not found");
  if (source.type !== target.type) {
    throw new ActionError("Can't merge climbs of different disciplines");
  }
  return { source, target };
}

/** Folds `sourceClimbId` into `targetClimbId`: the target survives (with
 * `overrides` applied to it, if given — a strict superset of applyClimbEdit,
 * not a separate heuristic), the source is deleted. Everything runs as one
 * `db.batch` (a single D1 transaction, per actions/import.ts's precedent) so
 * a mid-merge failure can't leave sends reassigned without the source climb
 * actually gone, or vice versa.
 *
 * Three steps, in an order that never trips the unique (userId, climbId)
 * index on `sends` for a user who logged both climbs:
 *  1. For each colliding pair, fold the source's comment into the surviving
 *     target send (joined with MERGE_COMMENT_SEPARATOR) rather than silently
 *     dropping it — its other fields (rating/dateSent/ascentStyle/
 *     suggestedGrade/gradeFeel) don't survive; the target's own values win.
 *  2. Delete the now-redundant colliding sends on the source.
 *  3. Reassign everything still on the source (by construction, no longer
 *     colliding) to the target.
 * No manual aggregate math is needed: 0014_sends_aggregate_triggers.sql's
 * `AFTER UPDATE` trigger already moves climbs.sendCount/ratingSum/ratingCount
 * when a send's climb_id changes, and its `AFTER DELETE` trigger covers step
 * 2's drops — both fire inside this same batch. */
export async function applyClimbMerge(
  db: Database,
  sourceClimbId: number,
  targetClimbId: number,
  overrides?: Partial<Pick<ClimbInput, "name" | "grade" | "description">>,
): Promise<void> {
  const { source, target } = await assertClimbMergeable(db, sourceClimbId, targetClimbId);

  // Aliased self-joins, not raw SQL: D1's `batch()` only accepts drizzle
  // query-builder statements (the same objects `db.update`/`db.delete`
  // return) — a `db.run(sql\`...\`)` type-checks as a batch item but fails at
  // runtime, since D1's driver expects each item's own prepared-statement
  // shape.
  const src = alias(sends, "src");
  const collidingTarget = alias(sends, "t");

  const statements = [
    // 1. Fold the source's comment into the surviving target send, for
    // every user who logged both climbs.
    db
      .update(sends)
      .set({
        comment: sql`CASE
          WHEN ${sends.comment} IS NULL THEN ${src.comment}
          WHEN ${src.comment} IS NULL THEN ${sends.comment}
          ELSE ${sends.comment} || ${MERGE_COMMENT_SEPARATOR} || ${src.comment}
        END`,
      })
      .from(src)
      .where(
        and(
          eq(sends.climbId, targetClimbId),
          eq(src.climbId, sourceClimbId),
          eq(src.userId, sends.userId),
        ),
      ),
    // 2. The source's half of each pair folded above is now redundant.
    db.delete(sends).where(
      and(
        eq(sends.climbId, sourceClimbId),
        exists(
          db
            .select({ one: sql`1` })
            .from(collidingTarget)
            .where(
              and(
                eq(collidingTarget.climbId, targetClimbId),
                eq(collidingTarget.userId, sends.userId),
              ),
            ),
        ),
      ),
    ),
    // 3. Everything still on the source is, by construction, non-colliding.
    db.update(sends).set({ climbId: targetClimbId }).where(eq(sends.climbId, sourceClimbId)),
    ...(overrides && Object.keys(overrides).length > 0
      ? [db.update(climbs).set(overrides).where(eq(climbs.id, targetClimbId))]
      : []),
    db.delete(climbs).where(eq(climbs.id, sourceClimbId)),
  ];
  await db.batch(statements as [(typeof statements)[number], ...typeof statements]);

  revalidatePath(`/climbs/${targetClimbId}`);
  revalidatePath(`/climbs/${sourceClimbId}`);
  revalidatePath(`/areas/${target.areaId}`);
  if (source.areaId !== target.areaId) revalidatePath(`/areas/${source.areaId}`);
  revalidatePath("/");
  refresh();
}
