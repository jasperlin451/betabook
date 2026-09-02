/** Keeps the browser-chrome theme-color in step with an explicit theme
 * choice. The layout's static metas are media-query scoped and only follow
 * the OS preference; an explicit light/dark pick appends a plain meta,
 * which wins by being last in tree order, and "system" removes it so the
 * media-scoped pair applies again. The boot script in app/layout.tsx
 * duplicates this logic for first paint — keep the two in sync. */
const THEME_COLORS: Record<"light" | "dark", string> = {
  light: "#eaf7ef",
  dark: "#000000",
};

export function syncThemeColorMeta(theme: string): void {
  if (typeof document === "undefined") return;
  for (const m of document.querySelectorAll('meta[name="theme-color"][data-explicit-theme]')) {
    m.remove();
  }
  if (theme === "light" || theme === "dark") {
    const m = document.createElement("meta");
    m.name = "theme-color";
    m.content = THEME_COLORS[theme];
    m.setAttribute("data-explicit-theme", "");
    document.head.appendChild(m);
  }
}
