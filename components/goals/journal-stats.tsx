"use client";

import { useState, type ReactNode } from "react";

import { DetailsDisclosure } from "@/components/ui/details-disclosure";

export function JournalStats({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="lg:hidden">
      <DetailsDisclosure title="Journal stats" isExpanded={expanded} onExpandedChange={setExpanded}>
        {children}
      </DetailsDisclosure>
    </div>
  );
}
