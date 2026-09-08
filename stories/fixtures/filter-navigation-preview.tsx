import { getRouter } from "@storybook/nextjs-vite/navigation.mock";
import { useLayoutEffect, type MouseEvent, type ReactNode } from "react";

import { searchParamsToRecord, type UrlParamsRecord } from "@/lib/url-params";

/** Model the page's URL-to-props round trip without leaving the isolated story. */
export function FilterNavigationPreview<T>({
  basePath,
  parseFilter,
  onFilterChange,
  children,
}: {
  basePath: string;
  parseFilter: (params: UrlParamsRecord) => T;
  onFilterChange: (filter: T) => void;
  children: ReactNode;
}) {
  function navigate(href: string) {
    const url = new URL(href, "https://storybook.invalid");
    if (url.pathname !== basePath) return;
    const params = searchParamsToRecord(url.searchParams);
    onFilterChange(parseFilter(params));
  }

  useLayoutEffect(() => {
    const router = getRouter();
    const previous = router.replace.getMockImplementation();
    router.replace.mockImplementation(navigate);
    return () => {
      router.replace.mockImplementation(previous ?? (() => {}));
    };
  });

  function followLink(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest("a");
    if (!link || new URL(link.href).pathname !== basePath) return;
    // Storybook's Link mock logs clicks instead of running the App Router.
    event.preventDefault();
    navigate(link.href);
  }

  return <div onClickCapture={followLink}>{children}</div>;
}
