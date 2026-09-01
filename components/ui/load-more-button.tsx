"use client";

import { Button } from "@heroui/react";

type LoadMoreButtonProps = {
  onPress: () => void;
  loading: boolean;
  /** The last page fetch failed — says so above the button, which stays
   * as the retry affordance. */
  failed?: boolean;
};

/** The foot of every paged list: an optional failure line and the button
 * that fetches the next page. Owns the copy so the seven lists that page
 * can't drift apart. */
export function LoadMoreButton({ onPress, loading, failed = false }: LoadMoreButtonProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {failed && <p className="text-sm text-danger">Couldn&apos;t load more — try again.</p>}
      <Button variant="ghost" onPress={onPress} isDisabled={loading}>
        {loading ? "Loading…" : "Load more"}
      </Button>
    </div>
  );
}
