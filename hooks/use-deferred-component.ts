"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";

/** Resolves to the component the chunk exports, so callers keep the named
 * export they already had rather than reshaping modules around a default. */
type Loader<P> = () => Promise<ComponentType<P>>;

/**
 * Keeps a chunk out of the initial bundle without making the user wait for it
 * on first use: the import is kicked off once the browser goes idle after
 * hydration, so an overlay's code is already in memory before there has been
 * time to click the thing that opens it.
 *
 * This is deliberately not `next/dynamic`. That starts the fetch when the lazy
 * element first renders, which for an always-mounted overlay is during
 * hydration — exactly the critical path we're trying to leave. Here the render
 * and the fetch are separated: nothing renders until the module is in hand.
 *
 * Returns `load` for the case where an interaction beats the idle callback.
 * Calling it twice is free — the bundler caches the module promise, so the
 * second call resolves off the first one's fetch.
 */
export function useDeferredComponent<P>(loader: Loader<P>): {
  Component: ComponentType<P> | null;
  load: () => void;
} {
  const [Component, setComponent] = useState<ComponentType<P> | null>(null);
  // The import can resolve after an unmount (a preload racing a navigation),
  // and setting state on a gone component warns.
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = useCallback(() => {
    async function run() {
      const resolved = await loader();
      // setState treats a bare function as an updater, so the component has
      // to be wrapped to be stored rather than called.
      if (alive.current) setComponent(() => resolved);
    }
    void run();
  }, [loader]);

  useEffect(() => {
    // Safari only shipped requestIdleCallback in 17.4, so the timeout below
    // is a live path on real traffic, not just a defensive guard. The
    // `timeout` caps how long a busy main thread can starve the preload.
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(load, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  return { Component, load };
}
