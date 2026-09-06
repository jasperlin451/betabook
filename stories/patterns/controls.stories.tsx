import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { choicePillClass } from "@/components/ui/choice-pill";
import { DISCIPLINE_CHIP_CLASSNAME } from "@/components/ui/discipline-chip";
import { IndexRangeSelect, LabeledIndexSelect } from "@/components/ui/index-select";
import { OptionSelect } from "@/components/ui/option-select";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { SortSelect } from "@/components/ui/sort-select";
import { Example, StoryPage } from "@/stories/fixtures/story-layout";

const meta = { title: "Patterns/Control comparisons", component: StoryPage } satisfies Meta<
  typeof StoryPage
>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
const grades = ["V0", "V1", "V2", "V3", "V4", "V5"];
function SelectExamples() {
  const [discipline, setDiscipline] = useState("boulder");
  const [index, setIndex] = useState(2);
  const [range, setRange] = useState<[number, number]>([1, 4]);
  const [sort, setSort] = useState("name_asc");
  return (
    <StoryPage title="Selects and ranges">
      <Example title="Fixed options">
        <OptionSelect
          ariaLabel="Discipline"
          value={discipline}
          onChange={setDiscipline}
          options={[
            { value: "boulder", label: "Boulder" },
            { value: "sport", label: "Sport" },
            { value: "trad", label: "Trad" },
          ]}
        />
      </Example>
      <Example title="Grade index">
        <LabeledIndexSelect label="Grade" options={grades} index={index} onChange={setIndex} />
      </Example>
      <Example title="Clamped range">
        <IndexRangeSelect
          label="Grades"
          minLabel="Minimum grade"
          maxLabel="Maximum grade"
          minOptions={grades}
          maxOptions={grades}
          range={range}
          onChange={setRange}
        />
      </Example>
      <Example title="Sort field and direction">
        <SortSelect
          sort={sort}
          fields={[
            { id: "name", label: "Name" },
            { id: "grade", label: "Grade" },
          ]}
          defaultField="name"
          defaultDirection={{ name: "asc", grade: "desc" }}
          onNavigate={setSort}
        />
        <output>{sort}</output>
      </Example>
    </StoryPage>
  );
}
export const Selects: Story = { render: () => <SelectExamples /> };
function ChoiceExamples() {
  const [feel, setFeel] = useState("solid");
  const [picked, setPicked] = useState(true);
  return (
    <StoryPage title="Segments and choice pills">
      <Example title="Exactly one choice">
        <SegmentedButtons
          value={feel}
          onChange={setFeel}
          options={[
            { value: "soft", label: "Soft" },
            { value: "solid", label: "Solid" },
            { value: "hard", label: "Hard" },
          ]}
        />
      </Example>
      <Example title="Tag-shaped choice">
        <div>
          <button
            type="button"
            aria-pressed={picked}
            onClick={() => setPicked(!picked)}
            className={choicePillClass(picked, DISCIPLINE_CHIP_CLASSNAME.boulder)}
          >
            Boulder
          </button>
        </div>
      </Example>
    </StoryPage>
  );
}
export const Choices: Story = { render: () => <ChoiceExamples /> };
