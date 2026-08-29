import type { ReactNode } from "react";
import { Disclosure } from "@heroui/react";

type Breakpoint = "md" | "lg";

// Tailwind only generates CSS for classes it finds as complete literal
// strings in source — building one via `${breakpoint}:flex` wouldn't
// generate the override, so each full class name is spelled out here and
// looked up by `breakpoint` instead.
const DESKTOP_CLASSNAME: Record<Breakpoint, string> = {
  md: "hidden flex-col gap-2 md:flex",
  lg: "hidden flex-col gap-2 lg:flex",
};
const MOBILE_CLASSNAME: Record<Breakpoint, string> = {
  md: "flex flex-col gap-2 md:hidden",
  lg: "flex flex-col gap-2 lg:hidden",
};

/** A section that's always open on desktop (from `breakpoint` up) and a
 * closed-by-default accordion below it. A `Disclosure`'s initial expanded
 * state is one render-time choice — it collapses via a native `hidden`
 * attribute, not a CSS class — so there's no single render that's "closed
 * on mobile, always open on desktop". Instead this renders `children`
 * twice, once per variant, each hidden via CSS rather than unmounted, so
 * only one is ever visible at a given width and the caller still only
 * writes its content once. */
export function CollapsibleSection({
  title,
  breakpoint = "md",
  showTitleOnDesktop = true,
  children,
}: {
  title: string;
  breakpoint?: Breakpoint;
  /** The mobile trigger always shows `title` — this only controls whether
   * the desktop variant also renders it as a heading above `children`. */
  showTitleOnDesktop?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <div className={DESKTOP_CLASSNAME[breakpoint]}>
        {showTitleOnDesktop && <h2 className="text-lg font-semibold">{title}</h2>}
        {children}
      </div>

      <Disclosure className={MOBILE_CLASSNAME[breakpoint]}>
        <Disclosure.Heading level={2} className="contents">
          <Disclosure.Trigger className="flex w-fit items-center gap-1 text-lg font-semibold">
            {title}
            <Disclosure.Indicator className="size-4" />
          </Disclosure.Trigger>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body style={{ padding: 0 }}>{children}</Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
    </>
  );
}
