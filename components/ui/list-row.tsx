import { type ReactNode } from "react";
import clsx from "clsx";
import { AppLink } from "@/components/ui/app-link";

type ListRowProps = {
  leading?: ReactNode;
  title: ReactNode;
  /** When set, `title` is wrapped in a link to `href` and the whole row
   * becomes its click target: an invisible overlay inside the link
   * stretches across the row (the row is the positioned ancestor), and the
   * row gets hover/focus-within feedback. Slots that hold their own
   * links/buttons (leading, subtitle, tags, actions) sit above the overlay
   * via z-index so they stay independently clickable. Rows without an
   * `href` get neither the overlay nor the hover affordance. */
  href?: string;
  meta?: ReactNode;
  subtitle?: ReactNode;
  tags?: ReactNode;
  trailing?: ReactNode;
  /** Rendered to the right of `trailing`, e.g. a "..." actions menu —
   * separate from `trailing` so it never gets pulled into that column's
   * own vertical stack. */
  actions?: ReactNode;
  comment?: string | null;
  className?: string;
};

export function ListRow({
  leading,
  title,
  href,
  meta,
  subtitle,
  tags,
  trailing,
  actions,
  comment,
  className,
}: ListRowProps) {
  return (
    <div
      className={clsx(
        // Guidebook route-table density: rows are separated by the list's
        // divide-y hairlines, so no rounding — px keeps the tap target
        // breathing while py-3 tightens the table.
        "relative flex items-center gap-4 px-4 py-3",
        href != null &&
          "transition-colors hover:bg-surface-secondary/50 focus-within:bg-surface-secondary/50",
        className,
      )}
    >
      {leading && <div className="relative z-10 shrink-0">{leading}</div>}
      {/* Text column + trailing block as a wrapping pair: on narrow screens
        * the trailing block drops below the text column (still right-aligned
        * via ml-auto) instead of crushing the title into a sliver. */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 grow basis-52 flex-col gap-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {href != null ? (
                  <AppLink href={href} className="static block max-w-full truncate">
                    {/* Stretches this link's click target across the whole
                      * row — `static` undoes the link's own `relative` so
                      * inset-0 resolves against the row instead. */}
                    <span aria-hidden className="absolute inset-0" />
                    {title}
                  </AppLink>
                ) : (
                  title
                )}
              </span>
              {meta && <span className="shrink-0 text-muted text-sm">{meta}</span>}
            </div>
            {subtitle && <div className="relative z-10 w-fit text-muted text-sm">{subtitle}</div>}
            {tags && <div className="relative z-10 mt-1 flex w-fit flex-wrap gap-2">{tags}</div>}
          </div>
          {comment != null && (
            <p className="line-clamp-3 text-sm leading-relaxed text-foreground">{comment}</p>
          )}
        </div>
        {trailing && <div className="ml-auto shrink-0 text-right tabular-nums">{trailing}</div>}
      </div>
      {actions && <div className="relative z-10 shrink-0">{actions}</div>}
    </div>
  );
}
