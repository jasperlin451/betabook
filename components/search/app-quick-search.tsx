"use client";
import { useState } from "react";

import { EMPTY_SEARCH, searchHref } from "@/lib/search";

import { SearchController } from "./search-controller";

export function AppQuickSearch({
  isOpen,
  onOpenChange,
  scopeAreaId,
  scopeAreaName,
  onNavigate,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  scopeAreaId?: number;
  scopeAreaName?: string;
  onNavigate: (href: string) => void;
}) {
  const [state, setState] = useState(EMPTY_SEARCH);
  const [wasOpen, setWasOpen] = useState(isOpen);
  // The provider lives across routes; each new dialog session starts globally.
  // Reset on opening so the previous content can finish its closing animation.
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (isOpen) setState(EMPTY_SEARCH);
  }
  return (
    <SearchController
      quick
      state={state}
      onChange={setState}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      suggestedArea={
        scopeAreaId !== undefined && scopeAreaName
          ? { id: String(scopeAreaId), name: scopeAreaName, path: "" }
          : undefined
      }
      onNavigate={(item) => onNavigate(item.href)}
      onExpand={() => onNavigate(searchHref(state))}
    />
  );
}
