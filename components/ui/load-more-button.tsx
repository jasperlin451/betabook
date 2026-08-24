"use client";

import { Button } from "@heroui/react";

type LoadMoreButtonProps = {
  onPress: () => void;
  loading: boolean;
};

export function LoadMoreButton({ onPress, loading }: LoadMoreButtonProps) {
  return (
    <Button variant="ghost" className="self-center" onPress={onPress} isDisabled={loading}>
      {loading ? "Loading…" : "Load more"}
    </Button>
  );
}
