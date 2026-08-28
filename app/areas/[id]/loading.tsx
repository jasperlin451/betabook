import { Skeleton, SkeletonListRows } from "@/components/ui/skeleton";

/** Mirrors the area page: breadcrumbs, title + description, sub-area chips,
 * then the climb list beside the lg:w-80 filter sidebar (which collapses to a
 * small disclosure trigger on mobile). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-56 max-w-full" />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-28" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="order-2 flex min-w-0 flex-1 flex-col gap-2 lg:order-1">
          <SkeletonListRows rows={8} />
        </div>
        <div className="order-1 lg:order-2 lg:w-80 lg:shrink-0">
          <Skeleton className="h-8 w-full rounded-xl lg:h-96" />
        </div>
      </div>
    </div>
  );
}
