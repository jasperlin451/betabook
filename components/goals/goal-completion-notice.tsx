"use client";

import { Button } from "@heroui/react";
import { CircleCheckBig, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { cardClass } from "@/components/ui/card";
import { useMounted } from "@/hooks/use-mounted";
import { goalTitle, type GoalProgress } from "@/lib/goals";

const presentations = {
  banner: {
    padding: "sm",
    surface: "bg-accent! text-accent-foreground",
    layout: "items-start pr-7",
    icon: "size-12 bg-black/10",
    iconSize: "size-6",
    headline: "font-display text-2xl font-semibold",
    description: "text-base font-medium",
    align: "justify-end",
    button: "border-accent-foreground/40 bg-transparent text-accent-foreground",
    sparkles: true,
  },
  compact: {
    padding: "sm",
    surface: "border border-accent/50 bg-accent/10!",
    layout: "items-start pr-7",
    icon: "size-10 bg-accent/20 text-accent-soft-foreground",
    iconSize: "size-6",
    headline: "text-lg font-semibold",
    description: "text-sm",
    align: "justify-end",
    button: "",
    sparkles: false,
  },
  milestone: {
    padding: "md",
    surface: "bg-accent! text-accent-foreground",
    layout: "flex-col items-center text-center",
    icon: "size-16 bg-black/10",
    iconSize: "size-9",
    headline: "font-display text-3xl font-semibold",
    description: "text-base font-medium",
    align: "justify-center",
    button: "border-accent-foreground/40 bg-transparent text-accent-foreground",
    sparkles: true,
  },
} as const;

export function goalCompletionKey(goal: GoalProgress) {
  return `betabook:goal-completed:${goal.userId}:${goal.id}:${goal.periodStart}`;
}
export function hasSeenGoalCompletion(goal: GoalProgress) {
  try {
    return localStorage.getItem(goalCompletionKey(goal)) === "true";
  } catch {
    return false;
  }
}

export function GoalCompletionNotice({
  goal,
  onView,
  onDismiss,
  appearance = "banner",
  rememberDismissal = true,
}: {
  goal: GoalProgress;
  onView: () => void;
  onDismiss?: () => void;
  appearance?: "banner" | "compact" | "milestone";
  rememberDismissal?: boolean;
}) {
  const mounted = useMounted();
  const [dismissed, setDismissed] = useState(false);
  const seen = rememberDismissal && mounted && hasSeenGoalCompletion(goal);
  if (!mounted || dismissed || seen) return null;
  function dismiss() {
    setDismissed(true);
    onDismiss?.();
    try {
      if (rememberDismissal) localStorage.setItem(goalCompletionKey(goal), "true");
    } catch {
      /* Optional preference. */
    }
  }
  const presentation = presentations[appearance];
  const headline =
    goal.repeat === "none"
      ? "You did it!"
      : goal.repeat === "week"
        ? "Weekly target met!"
        : "Monthly target met!";
  return (
    <div
      className={`relative overflow-hidden ${cardClass(presentation.padding)} ${presentation.surface}`}
      role="status"
    >
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        className={`absolute top-2 right-2 ${appearance === "compact" ? "" : "text-accent-foreground"}`}
        aria-label="Dismiss achievement"
        onPress={dismiss}
      >
        <X aria-hidden className="size-4" />
      </Button>
      <div className={`flex gap-4 ${presentation.layout}`}>
        <span
          className={`relative flex shrink-0 items-center justify-center rounded-full ${presentation.icon}`}
        >
          <CircleCheckBig aria-hidden className={presentation.iconSize} />
          {presentation.sparkles && (
            <Sparkles aria-hidden className="absolute -top-1 -right-2 size-5" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className={presentation.headline}>{headline}</h2>
          <p className={`${presentation.description} mt-1`}>{goalTitle(goal)}</p>
        </div>
      </div>
      <div className={`mt-3 flex ${presentation.align}`}>
        <Button
          size="sm"
          variant="outline"
          className={presentation.button}
          onPress={() => {
            dismiss();
            onView();
          }}
        >
          {goal.repeat === "none" ? "View achievement" : "View goal"}
        </Button>
      </div>
    </div>
  );
}
