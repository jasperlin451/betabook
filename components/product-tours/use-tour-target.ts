"use client";

import { useEffect, useState, type RefObject } from "react";

import {
  tourTargetScrollDelta,
  type TourRect,
  type TourViewport,
} from "@/lib/product-tour-position";

type TargetState = { rect: TourRect | null; viewport: TourViewport; cardHeight: number };

function readTargetRect(element: HTMLElement | null): TourRect | null {
  const bounds = element?.getBoundingClientRect();
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
  return { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
}

export function useTourTarget(
  target: string,
  page: RefObject<HTMLDivElement | null>,
  card: RefObject<HTMLDivElement | null>,
) {
  const [state, setState] = useState<TargetState>({
    rect: null,
    viewport: { width: 0, height: 0, top: 0 },
    cardHeight: 220,
  });
  useEffect(() => {
    let frame = 0;
    let observed: Element | null = null;
    let aligned = false;
    let lastWidth = 0;
    let lastHeight = 0;
    const resize = new ResizeObserver(schedule);
    if (card.current) resize.observe(card.current);

    function measure() {
      const visual = window.visualViewport;
      const viewport = {
        width: visual?.width ?? window.innerWidth,
        height: visual?.height ?? window.innerHeight,
        top: visual?.offsetTop ?? 0,
      };
      const cardHeight = card.current?.getBoundingClientRect().height ?? 220;
      const element =
        page.current?.querySelector<HTMLElement>(`[data-tour-target="${target}"]`) ?? null;
      if (element !== observed) {
        if (observed) resize.unobserve(observed);
        observed = element;
        if (element) resize.observe(element);
        aligned = false;
      }
      const rect = readTargetRect(element);
      const viewportChanged = lastWidth !== viewport.width || lastHeight !== viewport.height;
      lastWidth = viewport.width;
      lastHeight = viewport.height;
      if (rect && (!aligned || viewportChanged)) {
        aligned = true;
        const delta = tourTargetScrollDelta(rect, viewport, cardHeight);
        if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" });
        schedule();
      }
      setState({ rect, viewport, cardHeight });
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const mutation = new MutationObserver(schedule);
    if (page.current) mutation.observe(page.current, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [target, page, card]);
  return state;
}
