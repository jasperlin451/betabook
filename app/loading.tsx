import { Skeleton, SkeletonListRows } from "@/components/ui/skeleton";

/** Mirrors the search page: mode switch pill, then the search form panel
 * (above on mobile, left lg:w-96 column on desktop) beside the results list. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-64 rounded-full" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="lg:w-96 lg:shrink-0">
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <section className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <SkeletonListRows rows={6} />
        </section>
      </div>
    </div>
  );
}
