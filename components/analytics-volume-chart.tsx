"use client";
import { useState } from "react";
import {
  ReferenceLine,
  type TooltipContentProps,
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { choicePillClass } from "@/components/ui/choice-pill";
import { DISCIPLINE_HUE } from "@/components/ui/discipline-chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { useChartWidth } from "@/hooks/use-chart-width";
import type { ClimbType } from "@/lib/grades";
import { formatMonthLabel, type MonthlyVolume } from "@/lib/user-analytics";

function VolumeTooltip({
  active,
  payload,
  label: month,
  metricLabel,
}: Partial<TooltipContentProps<number, string>> & { metricLabel: string }) {
  return active && payload?.length ? (
    <div
      role="tooltip"
      className="rounded-panel border border-border bg-overlay p-3 text-xs text-foreground shadow-lg"
    >
      {formatMonthLabel(String(month))}: {String(payload[0].value)} {metricLabel}
    </div>
  ) : null;
}

export function AnalyticsVolumeChart({
  rows,
  type,
  journalVisible = false,
}: {
  rows: MonthlyVolume[];
  type: ClimbType;
  journalVisible?: boolean;
}) {
  const [metric, setMetric] = useState<"sends" | "days">("sends");
  const label = metric === "sends" ? "Sends" : "Days out";
  const { ref, width } = useChartWidth();
  return (
    <section aria-label="Volume over time" className="min-w-0" ref={ref}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Eyebrow>Volume over time</Eyebrow>
          <p className="text-xs text-muted">
            {metric === "sends"
              ? "Dated sends each month."
              : journalVisible
                ? "Distinct days with logged climbing sessions each month."
                : "Days with a dated send each month; private journal sessions aren’t included."}
          </p>
        </div>
        <div role="group" aria-label="Volume metric" className="flex gap-2">
          {(["sends", "days"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={metric === value}
              className={choicePillClass(metric === value, "bg-accent text-accent-foreground")}
              onClick={() => setMetric(value)}
            >
              {value === "sends" ? "Sends" : "Days out"}
            </button>
          ))}
        </div>
      </div>
      {rows.length ? (
        <div role="group" aria-label={`Monthly ${label.toLowerCase()}`} className="min-w-0">
          <LineChart
            key={metric}
            width={width}
            height={240}
            data={rows}
            margin={{ top: 16, right: 16, bottom: 8, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--separator)" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthLabel}
              minTickGap={40}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              width={32}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              isAnimationActive={false}
              cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
              content={<VolumeTooltip metricLabel={label.toLowerCase()} />}
            />
            <Line
              type="monotone"
              dataKey={metric}
              stroke={DISCIPLINE_HUE[type]}
              strokeWidth={2.5}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            {rows.length === 1 && (
              <ReferenceLine y={rows[0][metric]} stroke={DISCIPLINE_HUE[type]} strokeWidth={2.5} />
            )}
          </LineChart>
        </div>
      ) : (
        <p className="text-sm text-muted">No dated activity in the selected years.</p>
      )}
    </section>
  );
}
