"use client";

/** Polite screen-reader announcements for mutation outcomes that have no
 * visual navigation cue — a drawer closing after a successful edit, a row
 * disappearing after a delete, a send being logged. Sighted viewers see the
 * UI change; screen readers hear nothing unless we say something.
 *
 * The live region is a single visually-hidden element appended to
 * `document.body` outside the React tree, so it survives the announcing
 * component unmounting (drawers unmount the moment they close — exactly when
 * these messages are sent). Kept deliberately minimal: no toast system, no
 * queue, just one polite region.
 */

let region: HTMLElement | null = null;

function ensureRegion(): HTMLElement {
  if (region == null || !region.isConnected) {
    region = document.createElement("div");
    region.setAttribute("role", "status");
    region.setAttribute("aria-live", "polite");
    region.className = "sr-only";
    document.body.appendChild(region);
  }
  return region;
}

export function announce(message: string) {
  if (typeof document === "undefined") return;
  const node = ensureRegion();
  // Clear first, then set on a task boundary: screen readers only announce
  // live-region *changes*, and this also lets a just-created region register
  // before content lands (and re-announces a repeated identical message).
  node.textContent = "";
  window.setTimeout(() => {
    node.textContent = message;
  }, 100);
}
