"use client";

import { useEffect, useState } from "react";

/** True only after the first client render — gates on rendering
 * client-resolved state (session, theme, etc.) so the server and first
 * client render stay identical and hydration can't mismatch. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // One-time SSR/CSR reconciliation, not a derived-state sync: this fires
    // exactly once per mount, so it can't cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return mounted;
}
