"use client";
/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- Arrow keys inspect the data points in this named chart group. */
import { useRef, useState, type ReactNode, type PointerEvent } from "react";

/** Shared pointer, touch, and keyboard readout for chart data marks. */
export function ChartInspection({ label, children }: { label: string; children: ReactNode }) {
  const [detail, setDetail] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 8, y: 8 });
  const showPointer = (event: PointerEvent<HTMLDivElement>) => {
    const mark = (event.target as Element).closest("[data-chart-detail]");
    if (!mark) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setDetail(mark.getAttribute("data-chart-detail"));
    setPosition({
      x: Math.max(4, Math.min(event.clientX - bounds.left + 12, bounds.width - 224)),
      y: Math.max(4, Math.min(event.clientY - bounds.top - 52, bounds.height - 48)),
    });
  };
  const index = useRef(-1);
  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={0}
      className="relative min-w-0 rounded-panel focus-visible:status-focused [&_[data-chart-detail]]:cursor-crosshair [&_[data-chart-detail]:hover]:brightness-125"
      onPointerMove={showPointer}
      onPointerOver={showPointer}
      onPointerDown={showPointer}
      onPointerLeave={() => setDetail(null)}
      onBlur={() => setDetail(null)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        const marks = event.currentTarget.querySelectorAll("[data-chart-detail]");
        if (!marks.length) return;
        if (event.key === "Escape") {
          setDetail(null);
          return;
        }
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        index.current =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? marks.length - 1
              : Math.max(
                  0,
                  Math.min(marks.length - 1, index.current + (event.key === "ArrowLeft" ? -1 : 1)),
                );
        const mark = marks[index.current];
        setDetail(mark.getAttribute("data-chart-detail"));
        const bounds = event.currentTarget.getBoundingClientRect();
        const point = mark.getBoundingClientRect();
        setPosition({ x: Math.max(4, Math.min(point.x - bounds.x, bounds.width - 224)), y: 4 });
      }}
    >
      {children}
      <div
        className="pointer-events-none absolute z-10 w-max max-w-[min(13rem,calc(100%-8px))] text-xs"
        style={{ left: position.x, top: position.y }}
        aria-live="polite"
      >
        {detail && (
          <span
            role="tooltip"
            className="block rounded-panel border border-border bg-overlay p-3 text-foreground shadow-lg"
          >
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}
