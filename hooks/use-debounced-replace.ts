"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Debounces navigation to `href` — used by every filter panel/search form
 * that auto-navigates on each field change instead of requiring a submit. */
export function useDebouncedReplace(href: string, delayMs = 400): void {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace(href, { scroll: false });
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [href, delayMs, router]);
}
