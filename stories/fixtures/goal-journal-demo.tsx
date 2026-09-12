import { useState } from "react";

import { GoalPanel } from "@/components/goals/goal-panel";
import { DetailsDisclosure } from "@/components/ui/details-disclosure";
import { Eyebrow } from "@/components/ui/eyebrow";
import { StatStrip } from "@/components/ui/stat-strip";
import { SectionHeading } from "@/components/ui/typography";

import { goalPanelStoryArgs } from "./goal-samples";

export function GoalJournalContext({ empty = false }: { empty?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const stats = (
    <StatStrip
      cards={[
        {
          key: "month",
          heading: <Eyebrow>This month</Eyebrow>,
          stats: [
            { label: "Days out", value: 4 },
            { label: "Entries", value: 9 },
            { label: "Sent sessions", value: 3 },
          ],
        },
        {
          key: "all",
          heading: <Eyebrow>All time</Eyebrow>,
          stats: [
            { label: "Days out", value: 42 },
            { label: "Sessions", value: 86 },
            { label: "Training", value: 24 },
          ],
        },
      ]}
    />
  );
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <GoalPanel
          {...goalPanelStoryArgs}
          initialActive={empty ? { goals: [], hasMore: false } : goalPanelStoryArgs.initialActive}
          initialCompleted={
            empty ? { goals: [], hasMore: false } : goalPanelStoryArgs.initialCompleted
          }
        />
        <div className="lg:hidden">
          <DetailsDisclosure
            title="Journal stats"
            isExpanded={expanded}
            onExpandedChange={setExpanded}
          >
            {stats}
          </DetailsDisclosure>
        </div>
        <SectionHeading>September 2026</SectionHeading>
        <div className="border-y border-separator py-4">
          <p className="font-medium">Cedar Arete · V4</p>
          <p className="text-sm text-muted">Session · September 11</p>
          <p className="mt-2 text-sm">Found a better heel hook. One move closer.</p>
        </div>
        <div className="border-b border-separator pb-4">
          <p className="font-medium">Training</p>
          <p className="text-sm text-muted">September 9</p>
          <p className="mt-2 text-sm">Easy movement session. Practiced quiet feet.</p>
        </div>
      </div>
      <aside className="hidden lg:block" aria-label="Journal stats">
        {stats}
      </aside>
    </div>
  );
}
