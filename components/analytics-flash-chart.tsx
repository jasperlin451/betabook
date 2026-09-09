"use client";
import {
  ReferenceLine,
  type TooltipContentProps,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DISCIPLINE_HUE } from "@/components/ui/discipline-chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { useChartWidth } from "@/hooks/use-chart-width";
import type { ClimbType } from "@/lib/grades";
import type { FlashGradeRow } from "@/lib/user-analytics";

function FlashTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  const row = payload?.[0]?.payload as FlashGradeRow | undefined;
  return active && row ? (
    <div
      role="tooltip"
      className="rounded-panel border border-border bg-overlay p-3 text-xs text-foreground shadow-lg"
    >
      {row.label}: {row.sends} sends · {row.flashes} flashes · {Math.round(row.rate)}% flash rate
    </div>
  ) : null;
}

export function AnalyticsFlashChart({ rows, type }: { rows: FlashGradeRow[]; type: ClimbType }) {
  const { ref, width } = useChartWidth();
  return (
    <section aria-label="Flash rate by grade" className="min-w-0" ref={ref}>
      <div className="mb-4 flex flex-col gap-1">
        <Eyebrow>Flash rate by grade</Eyebrow>
        <p className="text-xs text-muted">
          Bars show total sends; the line shows the percentage logged as flashes. Onsights count as
          sends, not flashes.
        </p>
      </div>
      {rows.length ? (
        <>
          <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-xs"
                style={{ backgroundColor: DISCIPLINE_HUE[type], opacity: 0.7 }}
              />
              Total sends
            </span>
            <span className="flex items-center gap-2">
              <span className="w-4 border-t-2 border-foreground" />
              Flash rate
            </span>
          </div>
          <div role="group" aria-label="Sends and flash percentage by grade" className="min-w-0">
            <ComposedChart
              width={width}
              height={240}
              data={rows}
              margin={{ top: 16, right: 0, bottom: 8, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="var(--separator)" />
              <XAxis
                dataKey="label"
                minTickGap={12}
                tick={{ fontSize: 11, fill: "var(--muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="sends"
                allowDecimals={false}
                width={32}
                tick={{ fontSize: 11, fill: DISCIPLINE_HUE[type] }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="rate"
                orientation="right"
                domain={[0, 100]}
                width={40}
                tickFormatter={(rate) => `${rate}%`}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                isAnimationActive={false}
                cursor={{ fill: "var(--foreground)", fillOpacity: 0.04 }}
                content={<FlashTooltip />}
              />
              <Bar
                yAxisId="sends"
                dataKey="sends"
                fill={DISCIPLINE_HUE[type]}
                fillOpacity={0.65}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="rate"
                stroke="var(--foreground)"
                strokeWidth={2.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
              {rows.length === 1 && (
                <ReferenceLine
                  yAxisId="rate"
                  y={rows[0].rate}
                  stroke="var(--foreground)"
                  strokeWidth={2.5}
                />
              )}
            </ComposedChart>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">No graded sends in the selected years.</p>
      )}
    </section>
  );
}
