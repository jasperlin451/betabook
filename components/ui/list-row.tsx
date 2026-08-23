"use client";

import { type ReactNode, useState } from "react";
import clsx from "clsx";

const COMMENT_PREVIEW_LENGTH = 140;

type ListRowProps = {
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  subtitle?: ReactNode;
  tags?: ReactNode;
  trailing?: ReactNode;
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
  comment,
  className,
}: ListRowProps) {
  const [expanded, setExpanded] = useState(false);
  const truncated = comment != null && comment.length > COMMENT_PREVIEW_LENGTH;

  return (
    <div className={clsx("flex items-center gap-4 rounded-xl p-4", className)}>
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium text-foreground">{title}</span>
            {meta && <span className="text-muted text-sm">{meta}</span>}
          </div>
          {subtitle && <div className="text-muted text-sm">{subtitle}</div>}
          {tags && <div className="mt-1 flex flex-wrap gap-2">{tags}</div>}
        </div>
        {comment != null && (
          <p className="text-[0.925rem] leading-relaxed text-foreground">
            {expanded || !truncated ? comment : `${comment.slice(0, COMMENT_PREVIEW_LENGTH)}…`}
            {truncated && (
              <>
                {" "}
                <button
                  type="button"
                  className="cursor-pointer text-sm text-muted underline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpanded((value) => !value);
                  }}
                >
                  {expanded ? "Show less" : "Read comment"}
                </button>
              </>
            )}
          </p>
        )}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </div>
  );
}
