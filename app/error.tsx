"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Button, Link } from "@heroui/react";

/** Root error boundary — renders inside the root layout (header/footer stay),
 * catching render errors from every page. `retry()` re-fetches and re-renders
 * the failed segment, which is often enough for transient failures. */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted">
          An unexpected error kept this page from loading. It may be temporary
          — trying again often fixes it.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Button onPress={() => retry()}>Try again</Button>
        <Link href="/">Search from the home page</Link>
      </div>
    </div>
  );
}
