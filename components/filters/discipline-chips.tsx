"use client";

import { choicePillClass } from "@/components/ui/choice-pill";
import { DISCIPLINE_CHIP_CLASSNAME, DISCIPLINE_LABELS } from "@/components/ui/discipline-chip";
import type { Discipline } from "@/db/queries";

const DISCIPLINES: Discipline[] = ["boulder", "sport", "trad"];

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
              onChange(selected ? value.filter((d) => d !== discipline) : [...value, discipline])
            }
            className={choicePillClass(selected, DISCIPLINE_CHIP_CLASSNAME[discipline])}
          >
            {DISCIPLINE_LABELS[discipline]}
          </button>
        );
      })}
    </div>
  );
}
