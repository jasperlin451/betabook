import type { ReactNode } from "react";

import { ViewerBoundary } from "@/components/viewer-boundary";
import { getSession } from "@/lib/session";

export default async function Template({ children }: { children: ReactNode }) {
  const session = await getSession();
  return (
    <ViewerBoundary key={session?.user.id ?? "anonymous"} viewerId={session?.user.id ?? null}>
      {children}
    </ViewerBoundary>
  );
}
