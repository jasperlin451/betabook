import { Star } from "lucide-react";
import clsx from "clsx";

type RatingStarsProps = {
  rating: number | null;
  /** Individual sends only allow whole-number ratings — show those as
   * integers. Aggregates (e.g. a climb's average rating) are genuinely
   * fractional and should show one decimal place. */
  precision?: "integer" | "decimal";
  className?: string;
};

export function RatingStars({ rating, precision = "integer", className }: RatingStarsProps) {
  if (rating == null) {
    return <span className={clsx("text-muted text-sm", className)}>No rating</span>;
  }

  return (
    <span className={clsx("inline-flex items-center gap-1 text-sm font-medium", className)}>
      <Star className="size-4 fill-current text-warning" />
      {precision === "decimal" ? rating.toFixed(1) : Math.round(rating)}
    </span>
  );
}
