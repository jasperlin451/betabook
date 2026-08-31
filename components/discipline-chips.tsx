"use client";

import clsx from "clsx";
import { DISCIPLINE_CHIP_CLASSNAME, DISCIPLINE_LABELS } from "@/components/ui/discipline-chip";
import type { Discipline } from "@/db/queries";

export const DISCIPLINES: Discipline[] = ["boulder", "sport", "trad"];

/** Discipline toggles as the same palette chips the rows themselves wear —
 * three taps instead of a labelled checkbox group, which is what lets a whole
 * filter fit on one line. Shared by the list toolbars (via FilterToolbar) and
 * the climb picker, so "narrow by discipline" is one control everywhere.
 *
 * Multi-select, and none selected means all — the convention every filter in
 * the app follows (see toDisciplineGradeFilter). */
export function DisciplineChips({
  value,
  onChange,
}: {
  value: Discipline[];
  onChange: (value: Discipline[]) => void;
}) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label="Disciplines">
      {DISCIPLINES.map((discipline) => {
        const selected = value.includes(discipline);
        return (
          <button
            key={discipline}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onChange(
                selected ? value.filter((d) => d !== discipline) : [...value, discipline],
              )
            }
            className={clsx(
              "cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors",
              selected
                ? `border-transparent font-medium ${DISCIPLINE_CHIP_CLASSNAME[discipline]}`
                : "border-border text-muted hover:text-foreground",
            )}
          >
            {DISCIPLINE_LABELS[discipline]}
          </button>
        );
      })}
    </div>
  );
}
