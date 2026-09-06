import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { MapPin } from "lucide-react";

import { AscentStyle } from "@/components/ascent-style";
import { ClampedComment } from "@/components/ui/clamped-comment";
import { DisciplineChip } from "@/components/ui/discipline-chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Grade, GradeArrow } from "@/components/ui/grade";
import { ListRow } from "@/components/ui/list-row";
import { Example, StoryPage } from "@/stories/fixtures/story-layout";

const meta = { title: "Patterns/Climbing data", component: StoryPage } satisfies Meta<
  typeof StoryPage
>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
export const LabelsAndGrades: Story = {
  render: () => (
    <StoryPage title="Labels and grades">
      <Example title="Disciplines">
        <div className="flex flex-wrap gap-2">
          {(["boulder", "sport", "trad"] as const).map((type) => (
            <DisciplineChip key={type} type={type} />
          ))}
        </div>
      </Example>
      <Example title="Ascent styles">
        <div className="flex flex-wrap gap-2">
          {(["onsight", "flash", "redpoint"] as const).map((type) => (
            <AscentStyle key={type} type={type} />
          ))}
        </div>
      </Example>
      <Example title="Grades and community direction">
        <div className="flex gap-4">
          <Grade>
            V4
            <GradeArrow direction="up" label="Harder than posted" />
          </Grade>
          <Grade size="md">
            5.11a
            <GradeArrow direction="down" label="Softer than posted" />
          </Grade>
        </div>
      </Example>
      <Eyebrow icon={MapPin}>North Woods</Eyebrow>
    </StoryPage>
  ),
};
export const RowsAndComments: Story = {
  render: () => (
    <StoryPage title="Rows and comments">
      <div className="divide-y divide-separator">
        <ListRow
          title="Cedar Arete"
          subtitle="North Woods"
          href="/climbs/1/cedar-arete"
          trailing={<Grade>V4</Grade>}
          comment="A short note."
        />
        <ListRow
          title="A very long route name that wraps without hiding the trailing grade"
          subtitle="A long area name at the far end of the valley"
          trailing={<Grade>5.11a</Grade>}
        />
      </div>
      <Example title="Expandable note">
        <div className="max-w-sm text-sm">
          <ClampedComment>
            {"Worked the high foot, moved slowly across the slab, and found a better rest below the finish. ".repeat(
              5,
            )}
          </ClampedComment>
        </div>
      </Example>
    </StoryPage>
  ),
};
