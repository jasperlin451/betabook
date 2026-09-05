import type { ReactNode } from "react";

import { Eyebrow } from "@/components/ui/eyebrow";
import { PageTitle } from "@/components/ui/typography";

export function ProfileHeading({
  name,
  since,
  action,
}: {
  name: string;
  since: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <Eyebrow>Climber</Eyebrow>
        <PageTitle>{name}</PageTitle>
        <span className="mt-1 text-sm text-muted">Active since {since}</span>
      </div>
      {action && <div className="sm:shrink-0">{action}</div>}
    </div>
  );
}
