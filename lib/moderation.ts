import { and, eq, exists, isNotNull, isNull, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { refresh, revalidatePath } from "next/cache";

import type { Database } from "@/db/client";
import {
  getArea,
  getChangeRequestApprovals,
  getClimb,
  getPendingChangeRequests,
  getSubareas,
  getUser,
  hasClimbsInArea,
  type Area,
  type ChangeRequest,
  type Climb,
} from "@/db/queries";
import {
  adminAreaScopes,
  areas,
  changeRequestApprovals,
  changeRequests,
  climbs,
  journalEntries,
  sends,
  CHANGE_REQUEST_TYPES,
} from "@/db/schema";
import { ActionError } from "@/lib/action-result";
import type { AreaInput } from "@/lib/areas";
import {
  validateClimbMergeOverrides,
  type ClimbEditInput,
  type ClimbMergeOverrides,
} from "@/lib/climbs";
import { formatGrade } from "@/lib/grades";
import { isAdmin } from "@/lib/session";
import { areaHref, climbHref } from "@/lib/slug";

export type ChangeRequestType = (typeof CHANGE_REQUEST_TYPES)[number];

/** The validated, type-specific fields stored as `changeRequests.payload`
 * JSON. Edits store only the fields that *differ* from the entity at submit
 * time (see changedFields) — applying a delta can't clobber a field someone
 * else changed while the request sat in the queue, and the queue can show a
 * reviewer exactly what would change. Already validated by the submitting
 * action; approving re-checks that the operation is still legal (entity
 * still exists, discipline rule still holds, etc), and applyClimbMerge
 * re-validates `overrides` from scratch since a payload is just JSON. */
export type ChangeRequestPayload = {
  // Descriptions never ride along on an edit request: editing one is free
  // and instant for any signed-in user (updateArea/updateClimb), so a
  // moderated edit covers only the gated fields — an area's name, a climb's
  // name/discipline/grade.
  area_edit: Partial<Pick<AreaInput, "name">>;
  area_delete: Record<string, never>;
  area_reparent: { newParentId: number };
  climb_edit: Partial<ClimbEditInput>;
  climb_delete: Record<string, never>;
  climb_move: { newAreaId: number };
  // `type`/`areaId` are deliberately excluded: type must already match (see
  // assertClimbMergeable) and the target's area always wins a merge.
  climb_merge: { targetClimbId: number; overrides?: ClimbMergeOverrides };
};

/** The keys of `input` whose values differ from `existing` — what an edit
 * request stores as its payload, so approval only ever writes fields the
 * requester actually changed. */
export function changedFields<T extends Record<string, unknown>>(
  existing: Record<string, unknown>,
  input: T,
): Partial<T> {
  const delta: Partial<T> = {};
  for (const key of Object.keys(input) as (keyof T)[]) {
    if (input[key] !== existing[key as string]) delta[key] = input[key];
  }
  return delta;
}

/** Drizzle wraps the driver's error (DrizzleQueryError with the SQLite
 * error as `cause`), so the constraint message has to be looked for down
 * the cause chain, not just on the surface error. */
function isUniqueConstraintError(err: unknown): boolean {
  let current = err;
  while (current instanceof Error) {
    if (current.message.includes("UNIQUE constraint failed")) return true;
    current = current.cause;
  }
  return false;
}

/** Queues a change instead of applying it — the non-admin half of every
 * gated action's bypass-or-queue branch. Returns the new request's id. One
 * pending request per (type, entity, requester): a duplicate submit trips
 * change_requests_pending_unique and comes back as a friendly error rather
 * than a second queue entry. */
export async function submitChangeRequest<T extends ChangeRequestType>(
  db: Database,
  type: T,
  entityId: number,
  requestedBy: string,
  payload: ChangeRequestPayload[T],
): Promise<number> {
  try {
    const [{ id }] = await db
      .insert(changeRequests)
      .values({ type, entityId, requestedBy, payload: JSON.stringify(payload) })
      .returning({ id: changeRequests.id });
    return id;
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      throw new ActionError(
        "You already have a pending request for this — an admin will review it",
      );
    }
    throw err;
  }
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

export async function applyAreaEdit(
  db: Database,
  areaId: number,
  input: Partial<Pick<AreaInput, "name">>,
): Promise<void> {
  const existing = await getArea(db, areaId);
  if (!existing) throw new ActionError("Area not found");
  if (Object.keys(input).length === 0) throw new ActionError("No changes to apply");

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
 * `isAreaOrDescendant` does for the reparent cycle-guard. Operations that
 * touch two areas (reparent, move, merge) bypass only via isAdminForAllAreas
 * on both. */
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
  input: Partial<ClimbEditInput>,
): Promise<void> {
  const existing = await getClimb(db, climbId);
  if (!existing) throw new ActionError("Climb not found");
  if (Object.keys(input).length === 0) throw new ActionError("No changes to apply");

  const changesDiscipline = input.type !== undefined && input.type !== existing.type;
  const condition = changesDiscipline
    ? and(
        eq(climbs.id, climbId),
        notExists(db.select({ id: sends.id }).from(sends).where(eq(sends.climbId, climbs.id))),
      )
    : eq(climbs.id, climbId);
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
  if (await hasJournalEntriesForClimb(db, climbId)) {
    throw new ActionError("Can't delete a climb with journal entries");
  }
  return existing;
}

/** Journal entries reference climbs with an ON DELETE *restrict* FK
 * (drizzle/schema/journal.ts) — deleting a journaled climb would abort with
 * a raw driver error, so both the advisory assert and applyClimbDelete's
 * authoritative condition check it explicitly for a friendly message. Even a
 * sends-free climb can be journaled: a session note (`sent = 0`) needs no
 * send. */
async function hasJournalEntriesForClimb(db: Database, climbId: number): Promise<boolean> {
  const row = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(eq(journalEntries.climbId, climbId))
    .limit(1)
    .get();
  return row != null;
}

export async function applyClimbDelete(db: Database, climbId: number): Promise<void> {
  const deleted = await db
    .delete(climbs)
    .where(
      and(
        eq(climbs.id, climbId),
        notExists(db.select({ id: sends.id }).from(sends).where(eq(sends.climbId, climbs.id))),
        notExists(
          db
            .select({ id: journalEntries.id })
            .from(journalEntries)
            .where(eq(journalEntries.climbId, climbs.id)),
        ),
      ),
    )
    .returning({ areaId: climbs.areaId })
    .get();

  if (!deleted) {
    if (!(await getClimb(db, climbId))) throw new ActionError("Climb not found");
    const sent = await db
      .select({ id: sends.id })
      .from(sends)
      .where(eq(sends.climbId, climbId))
      .limit(1)
      .get();
    if (sent) throw new ActionError("Can't delete a climb with logged sends");
    throw new ActionError("Can't delete a climb with journal entries");
  }

  revalidatePath(`/areas/${deleted.areaId}`);
  revalidatePath("/");
  refresh();
}

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
 * `overrides` applied to it, if given), the source is deleted. `rawOverrides`
 * is re-validated from scratch here — it ultimately comes from a Server
 * Action argument or a stored JSON payload, both client-shaped at runtime,
 * so only the three whitelisted fields ever reach the UPDATE (see
 * validateClimbMergeOverrides). Everything runs as one `db.batch` (a single
 * D1 transaction, per actions/import.ts's precedent) so a mid-merge failure
 * can't leave sends reassigned without the source climb actually gone, or
 * vice versa.
 *
 * Sends and journal entries move together, in an order that satisfies both
 * the unique (userId, climbId) index on `sends` and the journal/send sync
 * triggers (0029_explicit_journal_ascents.sql):
 *  1. A colliding source send (its user also logged the target) that is
 *     undated but commented gets its comment preserved as a non-sent session
 *     entry on the target — the send row is about to go, and an undated send
 *     has no ascent entry carrying its text. Dated sends need nothing here:
 *     their journal entries carry the comment and survive the merge.
 *  2. Delete the colliding sends on the source. The target's own send wins
 *     wholesale — its comment can't absorb the source's, because
 *     send_journal_update_guard pins a send's comment to its ascent entry's
 *     body. send_journal_delete_sync then demotes the deleted sends' source-
 *     side entries (sent = 0, is_ascent = 0), which is also what clears the
 *     journal_ascent_unique index ahead of step 4.
 *  3. Reassign the remaining (non-colliding) sends. Must happen before step
 *     4: journal_sent_update_guard only lets a sent entry move to a climb
 *     where its user's matching send already lives.
 *  4. Reassign every source journal entry — session notes from users who
 *     never sent included; the FK on journal_entries.climbId is ON DELETE
 *     restrict, so nothing may still point at the source when it's deleted.
 * No manual aggregate math is needed: 0014_sends_aggregate_triggers.sql's
 * `AFTER UPDATE` trigger already moves climbs.sendCount/ratingSum/ratingCount
 * when a send's climb_id changes, and its `AFTER DELETE` trigger covers step
 * 2's drops — all of it fires inside this same batch. */
export async function applyClimbMerge(
  db: Database,
  sourceClimbId: number,
  targetClimbId: number,
  rawOverrides?: unknown,
): Promise<void> {
  const { source, target } = await assertClimbMergeable(db, sourceClimbId, targetClimbId);
  const overrides = validateClimbMergeOverrides(target, rawOverrides);

  // Aliased self-joins, not raw SQL: D1's `batch()` only accepts drizzle
  // query-builder statements (the same objects `db.update`/`db.delete`
  // return) — a `db.run(sql\`...\`)` type-checks as a batch item but fails at
  // runtime, since D1's driver expects each item's own prepared-statement
  // shape.
  const collidingTarget = alias(sends, "t");

  const collidesWithTarget = exists(
    db
      .select({ one: sql`1` })
      .from(collidingTarget)
      .where(
        and(eq(collidingTarget.climbId, targetClimbId), eq(collidingTarget.userId, sends.userId)),
      ),
  );

  const statements = [
    // 1. Preserve the comment of a colliding, undated source send as a
    // non-sent session note on the target, dated to the merge itself (the
    // send never had a date to inherit).
    // drizzle's insert().select() insists on the full column list in table
    // definition order — NULL id lets autoincrement assign, and the
    // timestamp expressions mirror the schema defaults.
    db.insert(journalEntries).select(
      db
        .select({
          id: sql<number>`null`.as("id"),
          userId: sends.userId,
          climbId: sql<number>`${targetClimbId}`.as("climb_id"),
          kind: sql<string>`'session'`.as("kind"),
          sent: sql<boolean>`0`.as("sent"),
          isAscent: sql<boolean>`0`.as("is_ascent"),
          entryDate: sql<string>`date('now')`.as("entry_date"),
          body: sends.comment,
          tags: sql<string | null>`null`.as("tags"),
          createdAt: sql<number>`(cast(unixepoch('subsecond') * 1000 as integer))`.as("created_at"),
          updatedAt: sql<number>`(cast(unixepoch('subsecond') * 1000 as integer))`.as("updated_at"),
        })
        .from(sends)
        .where(
          and(
            eq(sends.climbId, sourceClimbId),
            isNull(sends.dateSent),
            isNotNull(sends.comment),
            collidesWithTarget,
          ),
        ),
    ),
    // 2. The colliding sends themselves — the delete trigger demotes their
    // source-side journal entries in the same breath.
    db.delete(sends).where(and(eq(sends.climbId, sourceClimbId), collidesWithTarget)),
    // 3. Everything still on the source is, by construction, non-colliding.
    db.update(sends).set({ climbId: targetClimbId }).where(eq(sends.climbId, sourceClimbId)),
    // 4a. Ascent entries can't be UPDATEd across climbs at all —
    // journal_sent_update_guard's ascent branch requires OLD.climb_id =
    // NEW.climb_id, and re-promoting a demoted entry is equally blocked — so
    // the remaining (non-colliding; step 2 demoted the rest) ascents move by
    // copy-and-delete. The INSERT satisfies journal_sent_insert_guard
    // because step 3 already put the user's send, with the matching
    // date/comment, on the target.
    db.insert(journalEntries).select(
      db
        .select({
          id: sql<number>`null`.as("id"),
          userId: journalEntries.userId,
          climbId: sql<number>`${targetClimbId}`.as("climb_id"),
          kind: journalEntries.kind,
          sent: journalEntries.sent,
          isAscent: journalEntries.isAscent,
          entryDate: journalEntries.entryDate,
          body: journalEntries.body,
          tags: journalEntries.tags,
          createdAt: journalEntries.createdAt,
          updatedAt: journalEntries.updatedAt,
        })
        .from(journalEntries)
        .where(and(eq(journalEntries.climbId, sourceClimbId), eq(journalEntries.isAscent, true))),
    ),
    db
      .delete(journalEntries)
      .where(and(eq(journalEntries.climbId, sourceClimbId), eq(journalEntries.isAscent, true))),
    // 4b. Everything else — repeats, demoted entries, never-sent session
    // notes — moves by plain UPDATE, which the guard allows for
    // non-ascents once the matching send is already on the target.
    db
      .update(journalEntries)
      .set({ climbId: targetClimbId })
      .where(eq(journalEntries.climbId, sourceClimbId)),
    ...(Object.keys(overrides).length > 0
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

// --- Admin queue -------------------------------------------------------------

/** The area(s) a request's approval coverage is measured against. `area_*`
 * requests scope to the area itself; `climb_*` to the affected climb's
 * *current* area. Two-area operations scope to both sides: the entity's
 * current area *and* its destination for a reparent/move, the source *and*
 * target climbs' areas for a merge — a merge rewrites the target (reassigned
 * sends, overrides), so the target's side gets a say too, exactly like a
 * move's destination. `[]` when any entity the request needs is already gone
 * — deleted or merged away since it was submitted — which makes the request
 * un-approvable; any admin may reject it to clear the queue (see
 * loadReviewableRequest in actions/moderation.ts). */
export async function changeRequestScopeAreaIds(
  db: Database,
  request: ChangeRequest,
): Promise<number[]> {
  if (request.type === "area_reparent") {
    const area = await getArea(db, request.entityId);
    if (!area) return [];
    const { newParentId } = JSON.parse(request.payload) as ChangeRequestPayload["area_reparent"];
    if (!(await getArea(db, newParentId))) return [];
    return area.id === newParentId ? [area.id] : [area.id, newParentId];
  }
  if (request.type === "climb_move") {
    const climb = await getClimb(db, request.entityId);
    if (!climb) return [];
    const { newAreaId } = JSON.parse(request.payload) as ChangeRequestPayload["climb_move"];
    if (!(await getArea(db, newAreaId))) return [];
    return climb.areaId === newAreaId ? [climb.areaId] : [climb.areaId, newAreaId];
  }
  if (request.type === "climb_merge") {
    const source = await getClimb(db, request.entityId);
    if (!source) return [];
    const { targetClimbId } = JSON.parse(request.payload) as ChangeRequestPayload["climb_merge"];
    const target = await getClimb(db, targetClimbId);
    if (!target) return [];
    return source.areaId === target.areaId ? [source.areaId] : [source.areaId, target.areaId];
  }
  if (request.type.startsWith("area_")) {
    const area = await getArea(db, request.entityId);
    return area ? [area.id] : [];
  }
  const climb = await getClimb(db, request.entityId);
  return climb ? [climb.areaId] : [];
}

/** True if the session is an admin for at least one of `areaIds` — enough to
 * *see* a request in the queue and add an approval to it; actually applying
 * it takes full coverage (changeRequestCoverage). */
export async function isAdminForAnyArea(
  db: Database,
  session: { user: { id: string; role?: string | null } },
  areaIds: number[],
): Promise<boolean> {
  for (const areaId of areaIds) {
    if (await isAdminForArea(db, session, areaId)) return true;
  }
  return false;
}

/** True if the session is an admin for every one of `areaIds` (and there's
 * at least one) — what bypassing review means: an admin covering only the
 * source or only the destination of a two-area operation doesn't get to push
 * a change across a boundary they only half-manage, so it queues instead and
 * accumulates approvals until every side is covered. */
export async function isAdminForAllAreas(
  db: Database,
  session: { user: { id: string; role?: string | null } },
  areaIds: number[],
): Promise<boolean> {
  if (areaIds.length === 0) return false;
  for (const areaId of areaIds) {
    if (!(await isAdminForArea(db, session, areaId))) return false;
  }
  return true;
}

/** Records `userId`'s approval of a pending request — idempotent (the
 * composite PK makes a second approval by the same admin a no-op), so
 * callers don't need to pre-check. Whether the request then *applies* is a
 * separate question: changeRequestCoverage decides once every involved area
 * is covered. */
export async function recordChangeRequestApproval(
  db: Database,
  requestId: number,
  userId: string,
): Promise<void> {
  await db.insert(changeRequestApprovals).values({ requestId, userId }).onConflictDoNothing();
}

export type ChangeRequestCoverage = {
  scopeAreaIds: number[];
  approverIds: string[];
  /** Scope areas no current approver manages — empty means fully covered. */
  missingAreaIds: number[];
  complete: boolean;
};

/** Whether the approvals recorded so far collectively cover every area the
 * request touches. Recomputed live against adminAreaScopes (and each
 * approver's current role) rather than snapshotted at approval time: a
 * revoked grant or demoted admin stops counting on its own, and an entity
 * that moved since an approval is measured where it lives *now*. A request
 * whose scope resolves to `[]` (entity gone) is never complete — it can only
 * be rejected. */
export async function changeRequestCoverage(
  db: Database,
  request: ChangeRequest,
): Promise<ChangeRequestCoverage> {
  const scopeAreaIds = await changeRequestScopeAreaIds(db, request);
  const approvals = await getChangeRequestApprovals(db, request.id);
  const approverIds = approvals.map((approval) => approval.userId);

  const approverSessions: { user: { id: string; role?: string | null } }[] = [];
  for (const approverId of approverIds) {
    const approver = await getUser(db, approverId);
    if (approver) approverSessions.push({ user: { id: approver.id, role: approver.role } });
  }

  const missingAreaIds: number[] = [];
  for (const areaId of scopeAreaIds) {
    let covered = false;
    for (const approverSession of approverSessions) {
      if (await isAdminForArea(db, approverSession, areaId)) {
        covered = true;
        break;
      }
    }
    if (!covered) missingAreaIds.push(areaId);
  }

  return {
    scopeAreaIds,
    approverIds,
    missingAreaIds,
    complete: scopeAreaIds.length > 0 && missingAreaIds.length === 0,
  };
}

/** Every pending request scoped to an area this admin manages — strictly
 * their moderation surface, nothing from elsewhere. A request whose target
 * entity is already gone (scope `[]`) is invisible to everyone here; it can
 * still be rejected by any admin who reaches it (see loadReviewableRequest
 * in actions/moderation.ts), it just no longer clutters unrelated queues.
 * Filters in application code rather than a SQL join: with two-area types
 * needing entity lookups anyway and the pending queue expected to stay
 * small, a per-request isAdminForAnyArea check reads far more clearly than
 * folding the area/climb union and the recursive ancestor walk into one
 * query. */
export async function getVisibleChangeRequests(
  db: Database,
  session: { user: { id: string; role?: string | null } },
): Promise<ChangeRequest[]> {
  if (!isAdmin(session)) return [];
  const pending = await getPendingChangeRequests(db);
  const visible: ChangeRequest[] = [];
  for (const request of pending) {
    const areaIds = await changeRequestScopeAreaIds(db, request);
    if (areaIds.length > 0 && (await isAdminForAnyArea(db, session, areaIds))) {
      visible.push(request);
    }
  }
  return visible;
}

export type ChangeRequestDescription = {
  summary: string;
  href: string | null;
  /** One plain-language line per field the request would change, measured
   * against the entity's *current* state — what a reviewer actually needs to
   * judge a request, and what the decision email echoes back. */
  details: string[];
};

/** Description excerpts stay short enough for a queue row / plain-text
 * email line. */
function excerpt(value: string | null | undefined): string {
  if (value == null || value === "") return "(empty)";
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}

// One describer per request type, dispatched by `request.type` — a plain
// record instead of a switch so each case stays small and self-contained.
// Shared by the admin queue page (app/admin/requests) and the decision email
// (sendChangeRequestDecisionEmail via approveChangeRequest/
// rejectChangeRequest) so the two never describe the same request
// differently.
const CHANGE_REQUEST_DESCRIBERS: Record<
  ChangeRequestType,
  (db: Database, request: ChangeRequest) => Promise<ChangeRequestDescription>
> = {
  area_edit: async (db, request) => {
    const area = await getArea(db, request.entityId);
    const payload = JSON.parse(request.payload) as ChangeRequestPayload["area_edit"];
    const details: string[] = [];
    if (payload.name !== undefined) {
      details.push(`Name: "${area?.name ?? "?"}" → "${payload.name}"`);
    }
    return {
      summary:
        payload.name !== undefined
          ? `Rename "${area?.name ?? "an area"}" to "${payload.name}"`
          : `Edit "${area?.name ?? "an area"}"`,
      href: area ? areaHref(area.id, area.name) : null,
      details,
    };
  },
  area_delete: async (db, request) => {
    const area = await getArea(db, request.entityId);
    return {
      summary: `Delete "${area?.name ?? "an area"}"`,
      href: area ? areaHref(area.id, area.name) : null,
      details: [],
    };
  },
  area_reparent: async (db, request) => {
    const { newParentId } = JSON.parse(request.payload) as ChangeRequestPayload["area_reparent"];
    const [area, newParent] = await Promise.all([
      getArea(db, request.entityId),
      getArea(db, newParentId),
    ]);
    const currentParent = area?.parentId != null ? await getArea(db, area.parentId) : undefined;
    return {
      summary: `Move "${area?.name ?? "an area"}" under "${newParent?.name ?? "another area"}"`,
      href: area ? areaHref(area.id, area.name) : null,
      details: [`Parent: "${currentParent?.name ?? "(top level)"}" → "${newParent?.name ?? "?"}"`],
    };
  },
  climb_edit: async (db, request) => {
    const climb = await getClimb(db, request.entityId);
    const payload = JSON.parse(request.payload) as ChangeRequestPayload["climb_edit"];
    const details: string[] = [];
    if (payload.name !== undefined) {
      details.push(`Name: "${climb?.name ?? "?"}" → "${payload.name}"`);
    }
    if (payload.type !== undefined && climb) {
      details.push(`Discipline: ${climb.type} → ${payload.type}`);
    }
    if (payload.grade !== undefined && climb) {
      const newType = payload.type ?? climb.type;
      details.push(
        `Grade: ${formatGrade(climb.type, climb.grade)} → ${formatGrade(newType, payload.grade)}`,
      );
    }
    return {
      summary:
        payload.name !== undefined
          ? `Rename "${climb?.name ?? "a climb"}" to "${payload.name}"`
          : `Edit "${climb?.name ?? "a climb"}"`,
      href: climb ? climbHref(climb.id, climb.name) : null,
      details,
    };
  },
  climb_delete: async (db, request) => {
    const climb = await getClimb(db, request.entityId);
    return {
      summary: `Delete "${climb?.name ?? "a climb"}"`,
      href: climb ? climbHref(climb.id, climb.name) : null,
      details: [],
    };
  },
  climb_move: async (db, request) => {
    const { newAreaId } = JSON.parse(request.payload) as ChangeRequestPayload["climb_move"];
    const [climb, newArea] = await Promise.all([
      getClimb(db, request.entityId),
      getArea(db, newAreaId),
    ]);
    const currentArea = climb ? await getArea(db, climb.areaId) : undefined;
    return {
      summary: `Move "${climb?.name ?? "a climb"}" to "${newArea?.name ?? "another area"}"`,
      href: climb ? climbHref(climb.id, climb.name) : null,
      details: [`Area: "${currentArea?.name ?? "?"}" → "${newArea?.name ?? "?"}"`],
    };
  },
  climb_merge: async (db, request) => {
    const { targetClimbId, overrides } = JSON.parse(
      request.payload,
    ) as ChangeRequestPayload["climb_merge"];
    const [source, target] = await Promise.all([
      getClimb(db, request.entityId),
      getClimb(db, targetClimbId),
    ]);
    const details: string[] = [];
    if (source && target) {
      details.push(`${source.sendCount} send(s) move to "${target.name}"`);
    }
    if (overrides?.name !== undefined) {
      details.push(`Name: "${target?.name ?? "?"}" → "${overrides.name}"`);
    }
    if (overrides?.grade !== undefined && target) {
      details.push(
        `Grade: ${formatGrade(target.type, target.grade)} → ${formatGrade(target.type, overrides.grade)}`,
      );
    }
    if (overrides?.description !== undefined) {
      details.push(
        `Description: ${excerpt(target?.description)} → ${excerpt(overrides.description)}`,
      );
    }
    return {
      summary: `Mark "${source?.name ?? "a climb"}" as a duplicate of "${target?.name ?? "another climb"}"`,
      href: source ? climbHref(source.id, source.name) : null,
      details,
    };
  },
};

/** A short "what's being asked for" line, a link to the affected entity, and
 * a field-by-field account of what would change — a reviewer approves the
 * details, not just the headline, so every payload field shows up here. */
export function describeChangeRequest(
  db: Database,
  request: ChangeRequest,
): Promise<ChangeRequestDescription> {
  return CHANGE_REQUEST_DESCRIBERS[request.type](db, request);
}
