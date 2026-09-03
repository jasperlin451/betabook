"use client";

import { Kbd, useOverlayState } from "@heroui/react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";

import { useSearchScope } from "@/components/search-scope";
import { useDeferredComponent } from "@/hooks/use-deferred-component";
import { isApplePlatform, useModifierLabels } from "@/hooks/use-platform";

/** Module-level so its identity is stable across renders — the preload hook
 * keys its effect on the loader. */
const loadPaletteDialog = () =>
  import("@/components/command-palette-dialog").then((m) => m.PaletteDialog);

const OpenSearchContext = createContext<(() => void) | null>(null);

/** Opens the site-wide search palette from anywhere under the provider, so
 * every search affordance on the page is a way into the same palette rather
 * than a second search of its own. Null outside the provider. */
function useOpenSearch(): (() => void) | null {
  return useContext(OpenSearchContext);
}

/** Site-wide search on ⌘K (Ctrl+K off macOS) — a navigator, so every row
 * goes somewhere and the last one always escapes to full search rather than
 * dead-ending on "no results".
 *
 * Owns the palette and binds the chord, and hands `open` down so the header
 * button, the home page's entry, and the shortcut are three doors into one
 * search rather than three searches. Wraps the app because those doors sit
 * in different parts of the tree.
 *
 * Context-aware via `useSearchScope`: on an area page the first section is
 * that area's own routes, which is almost always what someone searching from
 * a crag page means. Those ids are then excluded from the global section, so
 * a scoped match never appears twice.
 *
 * The palette itself is a deferred chunk (see use-deferred-component): this
 * provider wraps every route, and `Modal` would otherwise put react-aria's
 * overlay machinery in the bundle for pages that have no overlay at all. The
 * state and the chord stay here — both are cheap, and the chord has to be
 * bound before the chunk arrives so an early ⌘K isn't swallowed. */
export function SearchPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const state = useOverlayState();
  const scope = useSearchScope();
  const { Component: PaletteDialog, load } = useDeferredComponent(loadPaletteDialog);

  const { open, setOpen, close } = state;
  // Pulls the chunk in on the way to opening, for the case where a very
  // early ⌘K beats the idle preload. Ordinarily this is already resolved and
  // the call is a no-op.
  const openPalette = useCallback(() => {
    load();
    open();
  }, [load, open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Command on Apple, Control on Windows/Linux (which have no Command
      // key at all) — deliberately not "either modifier": Ctrl+K is
      // kill-line in a macOS text field, and claiming it there would break
      // editing in every form on the site.
      const chord = isApplePlatform()
        ? event.metaKey && !event.ctrlKey
        : event.ctrlKey && !event.metaKey;
      if (!chord || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      openPalette();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openPalette]);

  const onNavigate = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  return (
    <OpenSearchContext.Provider value={openPalette}>
      {children}
      {PaletteDialog && (
        <PaletteDialog
          isOpen={state.isOpen}
          onOpenChange={setOpen}
          scopeAreaId={scope?.areaId}
          scopeAreaName={scope?.areaName}
          onNavigate={onNavigate}
        />
      )}
    </OpenSearchContext.Provider>
  );
}

/** The header's way into the palette, and where the shortcut is advertised.
 * Purely an affordance — the chord itself is bound by the provider, so it
 * works on pages that never render this.
 *
 * Stands down on any page carrying its own prominent search entry: two of
 * these on one screen, both badged with the same shortcut, read as two
 * searches. The hiding is a CSS `:has()` rule against `data-page-search`
 * (see globals.css) rather than unmounting, so it holds on the very first
 * paint instead of flashing a button that hydration then removes. */
export function SearchTrigger() {
  const openSearch = useOpenSearch();
  const keys = useModifierLabels();

  return (
    <button
      type="button"
      data-header-search
      onClick={() => openSearch?.()}
      aria-label="Search"
      aria-keyshortcuts={keys?.ariaPalette}
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-muted transition-colors hover:text-foreground focus-visible:status-focused"
    >
      <Search className="size-4" />
      <span className="hidden text-sm sm:inline">Search</span>
      {keys && <Kbd className="hidden sm:inline-flex">{keys.palette}</Kbd>}
    </button>
  );
}

/** The home page's way in: a full-width field-shaped button, sized and
 * placed like the search box a visitor expects to land on. It opens the same
 * palette the header and the shortcut do rather than searching on its own,
 * so there is one search on the site with three doors into it.
 *
 * A button, not an input: it would otherwise be a text field that takes a
 * keystroke and then hands both the keystroke and the focus to a different
 * text field, which drops characters on slower devices and reads as a jump.
 */
export function HomeSearchEntry() {
  const openSearch = useOpenSearch();
  const keys = useModifierLabels();

  return (
    <button
      type="button"
      // Marks this page as already carrying a search entry, which stands the
      // header's compact one down (see SearchTrigger).
      data-page-search
      onClick={() => openSearch?.()}
      aria-keyshortcuts={keys?.ariaPalette}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:border-muted focus-visible:status-focused"
    >
      <Search className="size-5 shrink-0 text-muted" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-muted">Search routes and areas</span>
      {keys && <Kbd className="hidden shrink-0 sm:inline-flex">{keys.palette}</Kbd>}
    </button>
  );
}
