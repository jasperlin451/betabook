import { Skeleton, SkeletonListRows, SkeletonStatCard } from "@/components/ui/skeleton";

/** Mirrors the climb page: eyebrow breadcrumbs, name + type/grade +
 * description, then the stats card (above on mobile, left lg:w-72 column on
 * desktop) beside the sends list. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-56 max-w-full" />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex flex-col gap-4 lg:w-72 lg:shrink-0">
          <SkeletonStatCard stats={3} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <Skeleton className="h-6 w-20" />
          <SkeletonListRows rows={5} />
        </div>
      </div>
    </div>
  );
}
