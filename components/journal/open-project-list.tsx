"use client";

import { Button, useOverlayState } from "@heroui/react";
import { CirclePlus } from "lucide-react";
import { useState } from "react";

import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { JournalEntryDrawer } from "@/components/journal/journal-entry-drawer";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Grade } from "@/components/ui/grade";
import { ListRow } from "@/components/ui/list-row";
import type { OpenProject } from "@/db/queries";
import { formatCount } from "@/lib/format";
import { formatDate } from "@/lib/format-date";
import { formatGrade } from "@/lib/grades";
import { climbHref } from "@/lib/slug";

export function OpenProjectList({ projects }: { projects: OpenProject[] }) {
  const state = useOverlayState();
  const [selected, setSelected] = useState<OpenProject | null>(null);

  if (projects.length === 0) {
    return <EmptyState message="No open projects. Log a session on a climb to start one." />;
  }

  return (
    <>
      <div className="flex flex-col divide-y divide-separator">
        {projects.map((project) => (
          <ListRow
            key={project.climbId}
            className="items-start"
            title={project.climbName}
            href={climbHref(project.climbId, project.climbName)}
            subtitle={
              <AreaBreadcrumb areaId={project.areaId} areaName={project.areaName} ancestors={[]} />
            }
            tags={
              <>
                <DisciplineChip type={project.climbType} />
                <Grade>{formatGrade(project.climbType, project.climbGrade)}</Grade>
              </>
            }
            trailing={
              <div className="flex flex-col items-end gap-1 text-sm">
                <span>{formatCount(project.sessionCount, "session")}</span>
                <span className="text-xs text-muted">Last {formatDate(project.lastSession)}</span>
              </div>
            }
            actions={
              <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label={`Log a session on ${project.climbName}`}
                onPress={() => {
                  setSelected(project);
                  state.open();
                }}
              >
                <CirclePlus className="size-5" />
              </Button>
            }
          />
        ))}
      </div>

      {selected && (
        <JournalEntryDrawer
          climb={{
            id: selected.climbId,
            name: selected.climbName,
            type: selected.climbType,
            grade: selected.climbGrade,
            areaId: selected.areaId,
          }}
          state={state}
        />
      )}
    </>
  );
}
