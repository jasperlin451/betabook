import { buttonVariants } from "@heroui/react";
import { Download } from "lucide-react";

import type { CatalogExportInfo } from "@/lib/catalog-export";
import { formatCount } from "@/lib/format";
import { formatDate } from "@/lib/format-date";

/** The /account card body for the weekly catalog snapshot. A plain anchor
 * with `download` rather than AppLink: the target is a route handler that
 * returns an attachment, and a client-side navigation to it would fail. */
export function CatalogExportDownload({ info }: { info: CatalogExportInfo | null }) {
  if (!info) {
    return <p className="text-sm text-muted">No snapshot yet — the first export runs on Monday.</p>;
  }
  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-sm text-muted">
        Last updated {formatDate(info.generatedAt)} · {formatCount(info.areaCount, "area")} ·{" "}
        {formatCount(info.climbCount, "climb")}
      </p>
      <a
        href="/api/catalog/export"
        download
        className={`${buttonVariants({ variant: "outline", fullWidth: true })} gap-2 text-foreground`}
      >
        <Download className="size-4" />
        Download catalog JSON
      </a>
    </div>
  );
}
