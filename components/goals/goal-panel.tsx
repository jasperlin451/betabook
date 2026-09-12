"use client";

import { Button, Menu, Modal, useOverlayState } from "@heroui/react";
import { CirclePlus } from "lucide-react";
import { useState } from "react";

import { saveGoal, deleteGoal } from "@/actions";
import { ProfileSectionNav } from "@/components/profile-tabs";
import { ActionsMenu } from "@/components/ui/actions-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { FIELD_WIDTH_CLASS } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { ListRow } from "@/components/ui/list-row";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { OptionSelect } from "@/components/ui/option-select";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useGoalsExpanded } from "@/hooks/use-goals-expanded";
import { useMounted } from "@/hooks/use-mounted";
import { apiFetch } from "@/lib/api-client";
import { goalDateLabel, recurringGoalResetLabel } from "@/lib/goal-date-label";
import {
  goalTitle,
  MAX_ACTIVE_GOALS,
  type GoalInput,
  type GoalPage,
  type GoalProgress,
  type GoalContribution,
  type GoalHistoryPage,
} from "@/lib/goals";

import {
  GoalCompletionNotice,
  goalCompletionKey,
  hasSeenGoalCompletion,
} from "./goal-completion-notice";
import { GoalDate, GOAL_ROW_CLASS } from "./goal-date";
import { GoalForm, type GoalDraft } from "./goal-form";
import { GoalItems } from "./goal-items";
import { GoalRecurringHistory } from "./goal-recurring-history";
import { GoalSection } from "./goal-section";

function draftFor(goal: GoalProgress): GoalDraft {
  return {
    category:
      goal.kind === "training"
        ? "training"
        : goal.kind === "days" || goal.kind === "new-areas"
          ? "explore"
          : "climbing",
    goal: goal.kind,
    discipline: goal.discipline ?? "boulder",
    gradeMatch: goal.gradeMatch ?? "exact",
    grade: goal.grade === null ? "any" : String(goal.grade),
    amount: String(goal.target),
    period: goal.timeframe,
    startDate: goal.startDate,
    endDate: goal.endDate,
    repeat: goal.repeat,
  };
}

// oxlint-disable-next-line complexity -- owner/viewer states, history pagination and edit/delete overlays
export function GoalPanel({
  ownerId,
  isOwner,
  initialActive,
  initialCompleted,
  timezone,
  today,
  nextGrades,
  initialView = "active",
  loadPage,
  loadItems,
  loadHistory,
}: {
  ownerId: string;
  isOwner: boolean;
  initialActive: GoalPage;
  initialCompleted: GoalPage;
  timezone: string;
  today: string;
  initialView?: "active" | "completed";
  loadPage?: (view: "active" | "completed", offset: number, year: number) => Promise<GoalPage>;
  loadItems?: (goal: GoalProgress) => Promise<GoalContribution[]>;
  loadHistory?: (goalId: number, offset: number, anchor?: string) => Promise<GoalHistoryPage>;
  nextGrades?: Partial<Record<"boulder" | "sport" | "trad", number>>;
}) {
  const mounted = useMounted();
  const [dismissedCompletions, setDismissedCompletions] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"active" | "completed">(initialView);
  const active = initialActive;
  const [completed, setCompleted] = useState(initialCompleted);
  const [year, setYear] = useState(initialCompleted.summary?.year ?? Number(today.slice(0, 4)));
  const [expanded, toggle] = useGoalsExpanded(ownerId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<GoalProgress | null>(null);
  const [deleting, setDeleting] = useState<GoalProgress | null>(null);
  const [pending, setPending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const editState = useOverlayState();
  const deleteState = useOverlayState();
  async function fetchPage(
    nextView: "active" | "completed",
    offset = 0,
    selectedYear = year,
  ): Promise<GoalPage> {
    if (loadPage) return loadPage(nextView, offset, selectedYear);
    const res = await apiFetch(
      `/api/users/${ownerId}/goals?view=${nextView}&offset=${offset}${nextView === "completed" ? `&year=${selectedYear}` : ""}`,
    );
    if (!res.ok) throw new Error("Could not load goals. Please try again.");
    return res.json() as Promise<GoalPage>;
  }
  async function changeYear(value: string) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const page = await fetchPage("completed", 0, Number(value));
      setCompleted(page);
      setYear(Number(value));
    } catch {
      setError("Could not load that year. Try again.");
    } finally {
      setLoading(false);
    }
  }
  async function more() {
    setLoading(true);
    setError("");
    try {
      const page = await fetchPage("completed", completed.goals.length);
      setCompleted((current) => ({ ...page, goals: [...current.goals, ...page.goals] }));
    } catch {
      setError("Could not load more goals. Try again.");
    } finally {
      setLoading(false);
    }
  }
  async function save(draft: GoalDraft) {
    const climbing = draft.goal === "volume" || draft.goal === "grade";
    const input: GoalInput = {
      kind: draft.goal,
      target: draft.goal === "grade" ? 1 : Number(draft.amount),
      discipline: climbing ? draft.discipline : null,
      grade: climbing && draft.grade !== "any" ? Number(draft.grade) : null,
      gradeMatch: draft.gradeMatch ?? "exact",
      timeframe: draft.period,
      repeat: draft.repeat,
      startDate: draft.startDate,
      endDate: draft.endDate,
      timezone: editing?.timezone ?? timezone,
    };
    const result = await saveGoal(editing?.id ?? null, input);
    if (!result.ok) throw new Error(result.error);
    editState.close();
    setEditing(null);
    setError("");
    // The action refreshes JournalView; its data key installs the updated lists.
  }
  async function remove() {
    if (!deleting) return;
    setDeletePending(true);
    setError("");
    try {
      const result = await deleteGoal(deleting.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      deleteState.close();
      setDeleting(null);
    } catch {
      setError("Could not delete the goal. Try again.");
    } finally {
      setDeletePending(false);
    }
  }
  const anyGoals =
    active.goals.length > 0 || completed.goals.length > 0 || (completed.years?.length ?? 0) > 1;
  const rows = view === "active" ? active.goals : completed.goals;
  if (!isOwner && !anyGoals) return null;
  const newlyCompleted =
    isOwner && mounted
      ? [...active.goals, ...completed.goals].find(
          (goal) =>
            goal.completedDate === today &&
            !dismissedCompletions.has(goalCompletionKey(goal)) &&
            !hasSeenGoalCompletion(goal),
        )
      : undefined;
  return (
    <>
      {newlyCompleted && (
        <GoalCompletionNotice
          key={`${newlyCompleted.id}-${newlyCompleted.periodStart}`}
          goal={newlyCompleted}
          onDismiss={() =>
            setDismissedCompletions(
              (current) => new Set([...current, goalCompletionKey(newlyCompleted)]),
            )
          }
          onView={() => {
            setView(newlyCompleted.repeat === "none" ? "completed" : "active");
            toggle(true);
          }}
        />
      )}
      <GoalSection
        title={isOwner ? "Your goals" : "Goals"}
        expanded={expanded}
        onExpandedChange={toggle}
        hasGoals={anyGoals}
        activeCount={active.goals.length}
        action={
          isOwner ? (
            <Button
              className="gap-2"
              isDisabled={active.goals.length >= MAX_ACTIVE_GOALS}
              onPress={() => {
                setEditing(null);
                editState.open();
              }}
            >
              <CirclePlus aria-hidden="true" className="size-5" />
              Set goal
            </Button>
          ) : undefined
        }
      >
        <ProfileSectionNav
          label="Goal views"
          tabs={[
            {
              label: `Active (${active.goals.length}${isOwner ? "/5" : ""})`,
              current: view === "active",
              onSelect: () => setView("active"),
            },
            {
              label: `Completed (${completed.total ?? completed.goals.length})`,
              current: view === "completed",
              onSelect: () => setView("completed"),
            },
          ]}
        />
        {view === "completed" && completed.summary && (
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="text-xs text-muted" aria-live="polite">
              <strong className="font-medium text-foreground">
                {completed.summary.achieved} {completed.summary.achieved === 1 ? "goal" : "goals"}{" "}
                achieved
              </strong>
            </div>
            {(completed.years?.length ?? 0) > 1 && (
              <OptionSelect
                ariaLabel="Achievement year"
                value={String(year)}
                onChange={(value) => {
                  void changeYear(value);
                }}
                className={FIELD_WIDTH_CLASS.short}
                options={(completed.years ?? [year]).map((value) => ({
                  value: String(value),
                  label: String(value),
                }))}
              />
            )}
          </div>
        )}
        <div className="divide-y divide-foreground/20">
          {rows.map((goal) => (
            <ListRow
              key={`${goal.id}-${goal.periodStart}`}
              wrapTitle
              fullWidthTags
              className={GOAL_ROW_CLASS}
              title={
                <span className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-sm">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-1">
                    <span>{goalTitle(goal)}</span>
                    {goal.discipline && <DisciplineChip type={goal.discipline} />}
                  </span>
                  {!(view === "completed" && goal.recurring) && (
                    <span className="ml-auto flex shrink-0 flex-col items-end gap-1 text-right">
                      <GoalDate completed={Boolean(goal.completedDate)}>
                        {goalDateLabel(
                          {
                            ...goal,
                            completedDate: view === "completed" ? goal.completedDate : null,
                          },
                          today,
                        )}
                      </GoalDate>
                    </span>
                  )}
                </span>
              }
              tags={
                <div className="flex w-full min-w-0 flex-col gap-2">
                  {view === "completed" ? (
                    <GoalItems ownerId={ownerId} goal={goal} loadItems={loadItems} />
                  ) : goal.kind !== "grade" ? (
                    <div className="flex w-full items-center gap-2">
                      <div className="w-24 [&>div]:h-1 dark:[&>div]:bg-white">
                        <ProgressBar
                          value={Math.min(goal.progress, goal.target)}
                          max={goal.target}
                          label={goalTitle(goal)}
                        />
                      </div>
                      <span className="text-xs tabular-nums">
                        {goal.progress}/{goal.target}
                      </span>
                      {goal.repeat !== "none" && goal.progress >= goal.target && (
                        <span className="ml-auto shrink-0 text-right text-xs font-normal text-muted">
                          {recurringGoalResetLabel(goal, today)}
                        </span>
                      )}
                    </div>
                  ) : undefined}
                  {view === "completed" && goal.recurring && (
                    <GoalRecurringHistory
                      key={`${goal.id}-${year}-${JSON.stringify(goal.recurring)}`}
                      ownerId={ownerId}
                      goal={goal}
                      today={today}
                      currentPeriod={active.goals.find((item) => item.id === goal.id)}
                      loadHistory={
                        loadHistory
                          ? (offset, anchor) => loadHistory(goal.id, offset, anchor)
                          : undefined
                      }
                    />
                  )}
                </div>
              }
              actions={
                isOwner ? (
                  <ActionsMenu
                    ariaLabel={`Actions for ${goalTitle(goal)}`}
                    onAction={(key) => {
                      if (key === "edit") {
                        setEditing(active.goals.find((item) => item.id === goal.id) ?? goal);
                        editState.open();
                      } else {
                        setDeleting(goal);
                        deleteState.open();
                        setError("");
                      }
                    }}
                  >
                    <Menu.Item id="edit">Edit</Menu.Item>
                    <Menu.Item id="delete">Delete</Menu.Item>
                  </ActionsMenu>
                ) : undefined
              }
            />
          ))}
        </div>
        {rows.length === 0 && (
          <div className="mt-2 text-xs font-normal text-muted">
            {view === "completed" ? "No completed goals yet." : "No active goals."}
          </div>
        )}
        {view === "completed" && (completed.total ?? 0) > 5 && (
          <p className="pt-2 text-xs text-muted" aria-live="polite">
            Showing {completed.goals.length} of {completed.total}
          </p>
        )}
        {view === "completed" && completed.hasMore && (
          <LoadMoreButton onPress={more} loading={loading} failed={Boolean(error)} />
        )}
      </GoalSection>
      {error && !deleteState.isOpen && <InlineAlert>{error}</InlineAlert>}
      {isOwner && (
        <>
          <Modal.Backdrop
            isOpen={editState.isOpen}
            onOpenChange={(open) => {
              if (!pending) editState.setOpen(open);
            }}
          >
            <Modal.Container placement="center" scroll="inside">
              <Modal.Dialog className="w-full max-w-lg">
                <Modal.Header>
                  <Modal.Heading className="sr-only">
                    {editing ? "Edit goal" : "Set goal"}
                  </Modal.Heading>
                  <Modal.CloseTrigger isDisabled={pending} />
                </Modal.Header>
                <Modal.Body>
                  {editState.isOpen && (
                    <GoalForm
                      embedded
                      initialDraft={editing ? draftFor(editing) : undefined}
                      today={today}
                      nextGrades={nextGrades}
                      onSave={save}
                      onCancel={editState.close}
                      onPendingChange={setPending}
                    />
                  )}
                </Modal.Body>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
          <ConfirmDeleteDialog
            state={deleteState}
            noun="goal"
            description="Your journal entries will be kept."
            onConfirm={remove}
            isPending={deletePending}
            error={error}
          />
        </>
      )}
    </>
  );
}
