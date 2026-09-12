import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { cardClass } from "@/components/ui/card";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { CatalogExportDownload } from "./catalog-export-download";

const meta = {
  title: "Components/Account/Catalog export",
  component: CatalogExportDownload,
} satisfies Meta<typeof CatalogExportDownload>;
export default meta;
type Story = StoryObj<typeof meta>;

function Example({ info }: React.ComponentProps<typeof CatalogExportDownload>) {
  return (
    <StoryPage
      title="Catalog data"
      description="The /account card for the weekly areas-and-climbs snapshot. The link is a plain download anchor, not a client navigation."
    >
      <div className={`flex flex-col gap-3 ${cardClass("md")}`}>
        <CatalogExportDownload info={info} />
      </div>
    </StoryPage>
  );
}

export const Available: Story = {
  args: {
    info: {
      generatedAt: "2026-09-14T06:00:00.000Z",
      areaCount: 412,
      climbCount: 5083,
      size: 1_204_000,
    },
  },
  render: (args) => <Example {...args} />,
};

export const Missing: Story = {
  args: { info: null },
  render: (args) => <Example {...args} />,
};
