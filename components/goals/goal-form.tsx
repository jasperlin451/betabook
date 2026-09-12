"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import { ArrowLeft, ArrowRight, Dumbbell, MapPin, Mountain } from "lucide-react";
import { useId, useRef, useState } from "react";

import { cardClass } from "@/components/ui/card";
import { choicePillClass } from "@/components/ui/choice-pill";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { DISCIPLINE_CHIP_CLASSNAME, DISCIPLINE_LABELS } from "@/components/ui/discipline-chip";
import { FIELD_WIDTH_CLASS } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { OptionSelect } from "@/components/ui/option-select";
import { PageTitle } from "@/components/ui/typography";
import { goalToday, goalWindow, type GoalInput } from "@/lib/goals";
import { nativeGradeArray, type ClimbType } from "@/lib/grades";

const NO_GRADE_HISTORY: Partial<Record<ClimbType, number>> = {};
const GOAL_CHOICE_CLASS = "h-auto w-full justify-start gap-3 px-4 py-4 text-left whitespace-normal";

const categories = [
  {
    value: "climbing",
    label: "Climbing goals",
    description: "Build volume or reach a new grade.",
    icon: Mountain,
  },
  {
    value: "training",
    label: "Training",
    description: "Set a session target or a weekly or monthly routine.",
    icon: Dumbbell,
  },
  {
    value: "explore",
    label: "Get out & explore",
    description: "Climb more days or visit more areas.",
    icon: MapPin,
  },
] as const;
type Category = (typeof categories)[number]["value"];
type Goal = GoalInput["kind"];
const goalOptions = {
  climbing: [
    { value: "volume", label: "Send a number of climbs" },
    { value: "grade", label: "Reach a new grade" },
  ],
  training: [{ value: "training", label: "Log training sessions" }],
  explore: [
    { value: "days", label: "Climb on more days" },
    { value: "new-areas", label: "Visit new areas" },
  ],
} satisfies Record<Category, { value: Goal; label: string }[]>;
export type GoalDraft = {
  category: Category;
  goal: Goal;
  discipline: ClimbType;
  grade: string;
  gradeMatch?: "exact" | "at-least";
  amount: string;
  period: GoalInput["timeframe"];
  startDate?: string;
  endDate: string;
  repeat: GoalInput["repeat"];
};

/** Shared goal editor; persistence is supplied by the journal panel. */
// oxlint-disable-next-line complexity -- conditional fields and validation for goal templates
export function GoalForm({
  initialCategory,
  initialGoal,
  initialCustomDate = false,
  initialStartDate,
  initialEndDate,
  initialDraft,
  onSave,
  onCancel,
  initialRepeat = "none",
  today = goalToday(new Intl.DateTimeFormat().resolvedOptions().timeZone),
  onPendingChange,
  embedded = false,
  nextGrades = NO_GRADE_HISTORY,
}: {
  initialCategory?: Category;
  initialGoal?: Goal;
  initialCustomDate?: boolean;
  initialStartDate?: string;
  initialEndDate?: string;
  initialDraft?: GoalDraft;
  onSave?: (draft: GoalDraft) => void | Promise<void>;
  today?: string;
  onPendingChange?: (pending: boolean) => void;
  embedded?: boolean;
  nextGrades?: Partial<Record<ClimbType, number>>;
  onCancel?: () => void;
  initialRepeat?: GoalInput["repeat"];
}) {
  const [category, setCategory] = useState<Category>(
    initialDraft?.category ?? initialCategory ?? "climbing",
  );
  const [step, setStep] = useState<"category" | "details">(
    initialDraft || initialCategory ? "details" : "category",
  );
  const [goal, setGoal] = useState<Goal>(
    initialDraft?.goal ?? initialGoal ?? goalOptions[category][0].value,
  );
  const [discipline, setDiscipline] = useState<ClimbType>(initialDraft?.discipline ?? "boulder");
  const [grade, setGrade] = useState(
    initialDraft?.grade ?? (initialGoal === "grade" ? String(nextGrades.boulder ?? 0) : "any"),
  );
  const [gradeMatch, setGradeMatch] = useState<"exact" | "at-least">(
    initialDraft?.gradeMatch ?? "exact",
  );
  const [amount, setAmount] = useState(
    initialDraft?.amount ?? (category === "training" ? "8" : "3"),
  );
  const [period, setPeriod] = useState(
    initialDraft?.period ?? (initialCustomDate ? "custom" : "month"),
  );
  const [startDate, setStartDate] = useState(initialDraft?.startDate ?? initialStartDate ?? today);
  const [endDate, setEndDate] = useState(
    initialDraft?.endDate ?? initialEndDate ?? goalWindow("month", today, today).endDate,
  );
  const [repeat, setRepeat] = useState(initialDraft?.repeat ?? initialRepeat);
  const isEditing = Boolean(initialDraft);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const backRef = useRef<HTMLButtonElement>(null);
  const categoryRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const grades = nativeGradeArray(discipline);
  const gradeOptions = grades.map((label, i) => ({ value: String(i), label }));
  const isClimbing = category === "climbing";
  const unit =
    goal === "training"
      ? "Training sessions"
      : goal === "days"
        ? "Climbing days"
        : isClimbing
          ? "Number of climbs"
          : "Number of areas";
  function navigate(next: typeof step) {
    setStep(next);
    requestAnimationFrame(() => {
      (next === "details" ? backRef : categoryRef).current?.focus();
    });
  }

  return (
    <div
      className={`mx-auto flex w-full flex-col gap-3 ${step === "details" ? "max-w-lg" : "max-w-xl"}`}
    >
      <section className={`flex flex-col gap-3 ${embedded ? "" : cardClass("sm", "bordered")}`}>
        {step === "category" ? (
          <>
            <div>
              <PageTitle className="text-foreground">What do you want to work on?</PageTitle>
            </div>
            <div className="flex flex-col gap-3">
              {categories.map(({ value, label, description, icon: Icon }, index) => (
                <Button
                  key={value}
                  ref={index === 0 ? categoryRef : undefined}
                  variant="outline"
                  className={GOAL_CHOICE_CLASS}
                  onPress={() => {
                    if (value !== category) {
                      setGoal(goalOptions[value][0].value);
                      setAmount(value === "climbing" ? "3" : "8");
                    }
                    setCategory(value);
                    if (value !== "training") setRepeat("none");
                    setError("");
                    navigate("details");
                  }}
                >
                  <Icon aria-hidden className="size-5 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="font-medium">{label}</span>
                    <span className="text-sm font-normal text-muted">{description}</span>
                  </span>
                  <ArrowRight aria-hidden className="size-4 shrink-0" />
                </Button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <Button
                ref={backRef}
                isDisabled={pending}
                variant="ghost"
                onPress={() => (isEditing && onCancel ? onCancel() : navigate("category"))}
              >
                <ArrowLeft aria-hidden className="size-4" />
                Back
              </Button>
            </div>
            <PageTitle className="text-2xl!">
              {categories.find((item) => item.value === category)?.label}
            </PageTitle>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (event) => {
                event.preventDefault();
                if (pending) return;
                if (goal !== "grade" && (!Number.isInteger(Number(amount)) || Number(amount) < 1)) {
                  setError("Enter a whole number of at least 1.");
                  return;
                }
                if (
                  repeat === "none" &&
                  period === "custom" &&
                  (!startDate || !endDate || endDate < startDate)
                ) {
                  setError("End date must be on or after start date.");
                  return;
                }
                setError("");
                setPending(true);
                onPendingChange?.(true);
                try {
                  if (onSave)
                    await onSave({
                      category,
                      goal,
                      discipline,
                      grade,
                      gradeMatch: goal === "volume" && grade !== "any" ? gradeMatch : "exact",
                      amount: goal === "grade" ? "1" : amount,
                      period,
                      startDate,
                      endDate,
                      repeat,
                    });
                } catch (cause) {
                  setError(
                    cause instanceof Error ? cause.message : "Could not save the goal. Try again.",
                  );
                } finally {
                  setPending(false);
                  onPendingChange?.(false);
                }
              }}
            >
              <fieldset disabled={pending} className="contents">
                {category !== "training" && (
                  <div className="flex flex-col gap-2">
                    <Label>Goal</Label>
                    <div
                      className="grid auto-cols-fr grid-flow-col gap-3"
                      role="group"
                      aria-label="Goal"
                    >
                      {goalOptions[category].map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          aria-pressed={goal === option.value}
                          variant="outline"
                          style={
                            goal === option.value
                              ? { backgroundColor: "var(--button-bg-hover)" }
                              : undefined
                          }
                          className="h-auto min-h-16 w-full justify-start rounded-panel! px-3 py-3 text-left text-sm whitespace-normal"
                          onPress={() => {
                            setGoal(option.value);
                            if (option.value === "grade" && grade === "any")
                              setGrade(
                                String(
                                  Math.min(
                                    nextGrades[discipline] ?? 0,
                                    nativeGradeArray(discipline).length - 1,
                                  ),
                                ),
                              );
                          }}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                {isClimbing && (
                  <div className="grid grid-cols-2 items-start gap-4">
                    <fieldset className="min-w-0">
                      <legend className="mb-2">
                        <Label>Discipline</Label>
                      </legend>
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(DISCIPLINE_LABELS) as ClimbType[]).map((value) => (
                          <label
                            key={value}
                            className={`${choicePillClass(value === discipline, DISCIPLINE_CHIP_CLASSNAME[value])} has-focus-visible:status-focused`}
                          >
                            <input
                              type="radio"
                              className="sr-only"
                              name={`${id}-discipline`}
                              value={value}
                              checked={value === discipline}
                              onChange={() => {
                                setDiscipline(value);
                                setGrade(
                                  goal === "grade"
                                    ? String(
                                        Math.min(
                                          nextGrades[value] ?? 0,
                                          nativeGradeArray(value).length - 1,
                                        ),
                                      )
                                    : "any",
                                );
                              }}
                            />
                            {DISCIPLINE_LABELS[value]}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="flex flex-col gap-2">
                      <Label>Grade</Label>
                      <OptionSelect
                        ariaLabel="Grade"
                        className={FIELD_WIDTH_CLASS.short}
                        value={grade}
                        onChange={setGrade}
                        options={
                          goal === "grade"
                            ? gradeOptions
                            : [{ value: "any", label: "Any" }, ...gradeOptions]
                        }
                      />
                      {goal === "volume" && grade !== "any" && (
                        <div
                          className="flex flex-wrap gap-1"
                          role="group"
                          aria-label="Grade matching"
                        >
                          {(
                            [
                              { value: "exact", label: "= Exactly" },
                              { value: "at-least", label: "≥ Or harder" },
                            ] as const
                          ).map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={gradeMatch === option.value}
                              onClick={() => setGradeMatch(option.value)}
                              className={`${choicePillClass(gradeMatch === option.value, "bg-default text-foreground")} text-xs`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 items-start gap-4">
                  <TextField
                    className={`flex flex-col gap-2 ${FIELD_WIDTH_CLASS.medium}`}
                    value={goal === "grade" ? "1" : amount}
                    onChange={setAmount}
                    isReadOnly={goal === "grade"}
                    isDisabled={goal === "grade"}
                    isRequired
                  >
                    <Label className="whitespace-nowrap">{unit}</Label>
                    <Input className={FIELD_WIDTH_CLASS.short} type="number" min={1} step={1} />
                  </TextField>
                  {repeat === "none" && (
                    <div className="col-start-2 flex min-w-0 flex-col gap-2">
                      <Label>Timeframe</Label>
                      <OptionSelect
                        ariaLabel="Timeframe"
                        className={FIELD_WIDTH_CLASS.medium}
                        value={period}
                        onChange={setPeriod}
                        options={[
                          { value: "month", label: "This month" },
                          { value: "week", label: "This week" },
                          { value: "year", label: "This year" },
                          { value: "custom", label: "Custom dates" },
                        ]}
                      />
                    </div>
                  )}
                </div>
                {category === "training" && (
                  <div className="flex flex-col gap-2">
                    <Label>Repeat</Label>
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Repeat">
                      {(
                        [
                          { value: "none", label: "Does not repeat" },
                          { value: "week", label: "Weekly" },
                          { value: "month", label: "Monthly" },
                        ] as const
                      ).map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={choicePillClass(
                            repeat === option.value,
                            "bg-accent text-accent-foreground",
                          )}
                          aria-pressed={repeat === option.value}
                          onClick={() => setRepeat(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {repeat === "none" && period === "custom" && (
                  <div className="grid grid-cols-1 items-start gap-4 min-[440px]:grid-cols-2">
                    <DatePickerField label="Start date" value={startDate} onChange={setStartDate} />
                    <DatePickerField label="End date" value={endDate} onChange={setEndDate} />
                  </div>
                )}
                {error && <InlineAlert>{error}</InlineAlert>}
                <div className="flex flex-wrap items-center justify-end gap-3 border-t border-separator pt-4">
                  <Button type="submit" isPending={pending}>
                    {isEditing ? "Save changes" : "Create goal"}
                  </Button>
                </div>
              </fieldset>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
