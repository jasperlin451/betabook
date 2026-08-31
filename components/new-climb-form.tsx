"use client";

import { useRouter } from "next/navigation";
import { ClimbForm } from "@/components/climb-form";
import type { ClimbType } from "@/lib/grades";

export function NewClimbForm({
  initial,
}: {
  initial?: { name?: string; type?: ClimbType; areaName?: string };
}) {
  const router = useRouter();

  return (
    <ClimbForm
      areaId={null}
      initial={initial}
      onDone={(climbId) => router.push(`/climbs/${climbId}`)}
    />
  );
}
