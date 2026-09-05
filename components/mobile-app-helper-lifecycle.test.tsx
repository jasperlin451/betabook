import type { EffectCallback } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileAppHelper } from "@/components/mobile-app-helper";

const hooks = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  saveState: vi.fn<(value: unknown) => void>(),
}));

// Exercise the component's actual event effect without a browser renderer.
// A paused tour must still retain the install event even though no panel renders.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: EffectCallback) => hooks.effects.push(effect),
  useState: (initial: unknown) => [initial, hooks.saveState],
  useCallback: (callback: unknown) => callback,
  useSyncExternalStore: () => true,
}));
vi.mock("@/hooks/use-mounted", () => ({ useMounted: () => true }));
vi.mock("@/hooks/use-deferred-component", () => ({
  useDeferredComponent: () => ({ Component: null, load: vi.fn<() => void>() }),
}));

afterEach(() => {
  hooks.effects.length = 0;
  hooks.saveState.mockClear();
  vi.unstubAllGlobals();
});

describe("mobile installation during a tour", () => {
  it("captures the install event while paused and removes the listener on unmount", () => {
    const browserEvents = new EventTarget();
    vi.stubGlobal("window", browserEvents);

    expect(MobileAppHelper()).toBeNull();
    const cleanups = hooks.effects.map((effect) => effect());
    const installEvent = new Event("beforeinstallprompt", { cancelable: true });
    browserEvents.dispatchEvent(installEvent);

    expect(installEvent.defaultPrevented).toBe(true);
    expect(hooks.saveState).toHaveBeenCalledWith(installEvent);

    for (const cleanup of cleanups) cleanup?.();
    hooks.saveState.mockClear();
    const afterUnmount = new Event("beforeinstallprompt", { cancelable: true });
    browserEvents.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
    expect(hooks.saveState).not.toHaveBeenCalled();
  });
});
