"use client";

import { useRouter } from "next/navigation";
import { ClimbForm } from "@/components/climb-form";

export function NewClimbForm() {
  const router = useRouter();

  return (
    <ClimbForm areaId={null} onDone={(climbId) => router.push(`/climbs/${climbId}`)} />
  );
}
