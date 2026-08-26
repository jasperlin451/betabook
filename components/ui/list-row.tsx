import { type ReactNode } from "react";
import clsx from "clsx";

type ListRowProps = {
  leading?: ReactNode;
  title: ReactNode;
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
  meta,
  subtitle,
  tags,
  trailing,
  actions,
  comment,
  className,
}: ListRowProps) {
  return (
    <div className={clsx("flex items-center gap-4 rounded-xl p-4", className)}>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{title}</span>
            {meta && <span className="shrink-0 text-muted text-sm">{meta}</span>}
          </div>
          {subtitle && <div className="text-muted text-sm">{subtitle}</div>}
          {tags && <div className="mt-1 flex flex-wrap gap-2">{tags}</div>}
        </div>
        {comment != null && (
          <p className="line-clamp-3 text-[0.925rem] leading-relaxed text-foreground">{comment}</p>
        )}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
