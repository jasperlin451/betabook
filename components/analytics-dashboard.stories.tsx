import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";

import { AnalyticsYearFilter } from "@/components/analytics-year-filter";
import type { AnalyticsSendRow } from "@/db/queries";
import { DEFAULT_ANALYTICS_LAYOUT } from "@/lib/analytics-layout";
import { buildUserAnalytics } from "@/lib/user-analytics";
import { StoryPage } from "@/stories/fixtures/story-layout";

import { AnalyticsDashboard } from "./analytics-dashboard";

const meta = {
  title: "Components/Charts/Analytics dashboard",
  component: AnalyticsDashboard,
} satisfies Meta<typeof AnalyticsDashboard>;
export default meta;
type Story = StoryObj;

const sends: AnalyticsSendRow[] = [
  ["2024-04-03", 6, "First high point"],
  ["2025-01-01", 3, "Winter warmup"],
  ["2025-08-15", 4, "Summer slab"],
  ["2026-04-02", 7, "New high point"],
  [null, 8, "An undated ascent"],
].map(([dateSent, suggestedGrade, climbName], index) => ({
  climbId: index + 1,
  climbName: String(climbName),
  climbType: "boulder",
  suggestedGrade: Number(suggestedGrade),
  dateSent: dateSent == null ? null : String(dateSent),
  areaId: 1,
  areaName: "Forestland",
  ascentStyle: index === 2 ? "flash" : "redpoint",
}));

const ALL_YEARS: number[] = [];

function DashboardExample({
  initialPeriod = ALL_YEARS,
  undatedOnly = false,
  persistent = false,
  visitor = false,
  saveFails = false,
}: {
  initialPeriod?: number[];
  undatedOnly?: boolean;
  persistent?: boolean;
  visitor?: boolean;
  saveFails?: boolean;
}) {
  const [period, setPeriod] = useState<number[]>(initialPeriod);
  const rows = undatedOnly ? sends.filter((send) => send.dateSent == null) : sends;
  const lifetime = buildUserAnalytics(rows, "boulder");
  const analytics = buildUserAnalytics(rows, "boulder", undefined, period);
  return (
    <StoryPage title="Analytics">
      <AnalyticsDashboard
        canCustomize={!visitor}
        initialLayout={
          persistent
            ? {
                ...DEFAULT_ANALYTICS_LAYOUT,
                cards: [
                  "hardest",
                  ...DEFAULT_ANALYTICS_LAYOUT.cards.filter((id) => id !== "hardest"),
                ],
                hidden: ["areas"],
              }
            : undefined
        }
        onSave={async () =>
          saveFails
            ? { ok: false, error: "Your layout couldn’t be saved. Please try again." }
            : { ok: true, value: undefined }
        }
        analytics={analytics}
        undatedCount={lifetime.datelessCount}
        scope="boulder"
        journalVisible={false}
        selectedYears={period}
        periodPicker={
          <AnalyticsYearFilter
            years={undatedOnly ? [] : [2023, 2024, 2025, 2026]}
            selected={period}
            onChange={setPeriod}
          />
        }
      />
    </StoryPage>
  );
}

export const AllTime: Story = { render: () => <DashboardExample /> };
export const SelectedYear: Story = { render: () => <DashboardExample initialPeriod={[2025]} /> };
export const EmptyYear: Story = { render: () => <DashboardExample initialPeriod={[2023]} /> };
export const UndatedOnly: Story = { render: () => <DashboardExample undatedOnly /> };

export const MultipleYears: Story = {
  render: () => <DashboardExample initialPeriod={[2024, 2025]} />,
};

export const SavedLayout: Story = {
  render: () => <DashboardExample persistent initialPeriod={[2024, 2025]} />,
};

export const AnotherProfile: Story = { render: () => <DashboardExample visitor /> };
export const SaveFailure: Story = {
  render: () => <DashboardExample saveFails initialPeriod={[2024, 2025]} />,
};
