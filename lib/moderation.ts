import { and, eq, notExists, sql } from "drizzle-orm";
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
import { areas, changeRequests, climbs, sends, CHANGE_REQUEST_TYPES } from "@/db/schema";
import { ActionError } from "@/lib/action-result";
import type { AreaInput } from "@/lib/areas";
import type { ClimbInput } from "@/lib/climbs";

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
  climb_merge: { targetClimbId: number; overrides?: Partial<ClimbInput> };
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
