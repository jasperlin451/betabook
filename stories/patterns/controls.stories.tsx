import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { choicePillClass } from "@/components/ui/choice-pill";
import { DISCIPLINE_CHIP_CLASSNAME } from "@/components/ui/discipline-chip";
import { SegmentedButtons } from "@/components/ui/segmented-buttons";
import { Example, StoryPage } from "@/stories/fixtures/story-layout";

const meta = { title: "Patterns/Control comparisons", component: StoryPage } satisfies Meta<
  typeof StoryPage
>;
export default meta;
// These local-state/comparison examples supply their own component props.
type Story = StoryObj;
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
