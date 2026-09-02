"use client";

import { useRouter } from "next/navigation";

import { AreaForm } from "@/components/area-form";

export function NewAreaForm() {
  const router = useRouter();

  return <AreaForm parentId={null} onDone={(areaId) => router.push(`/areas/${areaId}`)} />;
}
