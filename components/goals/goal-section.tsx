"use client";

import { Disclosure } from "@heroui/react";
import type { ReactNode } from "react";

import { cardClass } from "@/components/ui/card";
import { EYEBROW_CLASS } from "@/components/ui/eyebrow";

/** Keep the header visible outside the collapsible surface, like mobile journal stats. */
export function GoalSection({
  title,
  expanded,
  onExpandedChange,
  hasGoals,
  activeCount,
  action,
  children,
}: {
  title: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  hasGoals: boolean;
  activeCount: number;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Disclosure
      isExpanded={expanded}
      onExpandedChange={onExpandedChange}
      className="flex flex-col gap-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {hasGoals ? (
          <Disclosure.Heading level={2} className="contents">
            <Disclosure.Trigger
              className={`flex min-h-11 w-fit cursor-pointer items-center gap-2 ${EYEBROW_CLASS}`}
            >
              <span>
                {title}
                {!expanded && (
                  <span className="font-normal tracking-normal normal-case">
                    {" "}
                    · {activeCount} active
                  </span>
                )}
              </span>
              <Disclosure.Indicator className="ms-0 size-4" />
            </Disclosure.Trigger>
          </Disclosure.Heading>
        ) : (
          <h2 className={`flex min-h-11 items-center ${EYEBROW_CLASS}`}>{title}</h2>
        )}
        {action}
      </div>
      {hasGoals ? (
        <Disclosure.Content>
          <Disclosure.Body style={{ padding: 0 }}>
            <div className={`mt-2 flex flex-col gap-0 p-3! ${cardClass("sm")}`}>{children}</div>
          </Disclosure.Body>
        </Disclosure.Content>
      ) : (
        <div className={`mt-2 p-3! ${cardClass("sm")}`}>
          <p className="text-xs font-normal text-muted">No goals set yet.</p>
        </div>
      )}
    </Disclosure>
  );
}
