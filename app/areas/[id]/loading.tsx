import { Skeleton, SkeletonListRows } from "@/components/ui/skeleton";

/** Mirrors the area page's crag header (breadcrumbs, eyebrow, display
 * title, description, mono info strip, grade histogram), the sub-area
 * block, then the climb table beside the lg:w-80 filter sidebar. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-56 max-w-full" />

      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="mt-2 flex items-end gap-6">
          <Skeleton className="h-20 w-64 max-w-[45%]" />
          <Skeleton className="h-20 w-64 max-w-[45%]" />
        </div>
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
