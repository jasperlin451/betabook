import { Skeleton, SkeletonListRows, SkeletonStatCard } from "@/components/ui/skeleton";

/** Mirrors the user page's three regions: filters lead on mobile and share
 * the lg:w-80 sidebar with the stats card on desktop, while a second stats
 * copy trails the send list on mobile. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56 max-w-full" />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="order-1 flex flex-col gap-6 lg:order-2 lg:w-80 lg:shrink-0">
          <Skeleton className="h-8 w-full rounded-xl lg:h-64" />
          <div className="hidden lg:block">
            <SkeletonStatCard stats={3} />
          </div>
        </div>

        <div className="order-2 flex min-w-0 flex-1 flex-col gap-4 lg:order-1">
          <SkeletonListRows rows={8} />
        </div>

        <div className="order-3 lg:hidden">
          <SkeletonStatCard stats={3} />
        </div>
      </div>
    </div>
  );
}
