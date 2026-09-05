"use client";

import { useEffect, useState, type RefObject } from "react";

import { clipTourTarget, tourTargetScrollDelta, type TourRect } from "@/lib/product-tour-position";

export function useTourTarget(target: string, page: RefObject<HTMLDivElement | null>) {
  const [rect, setRect] = useState<TourRect | null>(null);
  useEffect(() => {
    let frame = 0;
    let observed: HTMLElement | null = null;
    let needsAlignment = true;
    let introduce = true;
    const resize = new ResizeObserver((entries) => {
      if (entries.some((entry) => entry.target === page.current)) introduce = true;
      needsAlignment = true;
      schedule();
    });
    if (page.current) resize.observe(page.current);

    function measure() {
      const container = page.current;
      if (!container) return;
      const element = container.querySelector<HTMLElement>(`[data-tour-target="${target}"]`);
      if (element !== observed) {
        if (observed) resize.unobserve(observed);
        observed = element;
        if (element) resize.observe(element);
        needsAlignment = true;
        introduce = true;
      }
      if (!element) {
        setRect(null);
        return;
      }
      const bounds = element.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        setRect(null);
        return;
      }
      const viewport = container.getBoundingClientRect();
      if (needsAlignment) {
        needsAlignment = false;
        const delta = tourTargetScrollDelta(bounds, viewport, introduce);
        introduce = false;
        if (Math.abs(delta) > 1) container.scrollBy({ top: delta, behavior: "instant" });
      }
      setRect(clipTourTarget(element.getBoundingClientRect(), viewport));
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const mutation = new MutationObserver(schedule);
    if (page.current) mutation.observe(page.current, { childList: true, subtree: true });
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [target, page]);
  return rect;
}
