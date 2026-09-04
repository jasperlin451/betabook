import type { ReactNode } from "react";

import { AreaBreadcrumb } from "@/components/area-breadcrumb";
import { ListRow } from "@/components/ui/list-row";
import type { AreaBreadcrumbs } from "@/db/queries";
import { formatDate } from "@/lib/format-date";
import { climbHref } from "@/lib/slug";

export function ClimbLogRow({
  climb,
  areaBreadcrumbs,
  grade,
  status,
  date,
  tags,
  comment,
  actions,
}: {
  climb: {
    id: number;
    name: string;
    areaId: number;
    areaName: string;
  };
  areaBreadcrumbs: AreaBreadcrumbs;
  grade: ReactNode;
  status: ReactNode;
  date: string | null;
  tags?: ReactNode;
  comment?: string | null;
  actions?: ReactNode;
}) {
  return (
    <ListRow
      title={climb.name}
      href={climbHref(climb.id, climb.name)}
      subtitle={
        <AreaBreadcrumb
          areaId={climb.areaId}
          areaName={climb.areaName}
          ancestors={areaBreadcrumbs[climb.areaId] ?? []}
        />
      }
      tags={tags}
      trailing={
        <div className="flex flex-col items-end gap-1 text-sm">
          {grade}
          {status}
          <div className="text-xs text-muted">{formatDate(date)}</div>
        </div>
      }
      actions={actions}
      comment={comment}
    />
  );
}
