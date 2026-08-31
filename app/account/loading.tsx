import { FORM_CARD_CLASS } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the account page's centered max-w-sm settings card. */
export default function Loading() {
  return (
    <div className={FORM_CARD_CLASS}>
      <Skeleton tone="raised" className="h-5 w-24" />
      <Skeleton tone="raised" className="h-4 w-48" />
      <Skeleton tone="raised" className="h-4 w-32" />
      <Skeleton tone="raised" className="h-4 w-28" />
      <Skeleton tone="raised" className="h-9 w-full rounded-lg" />
      <Skeleton tone="raised" className="h-9 w-full rounded-lg" />
    </div>
  );
}
