"use client";

import { Button, ListBox, Select, Skeleton, useTheme } from "@heroui/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";

const THEME_CYCLE = ["light", "dark", "system"] as const;
type ThemeName = (typeof THEME_CYCLE)[number];

const THEME_ICON: Record<ThemeName, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** Compact header theme control: one icon button cycling light → dark →
 * system. The full three-option Select stays on /account (ThemeToggle
 * below) for anyone who wants to pick directly. */
export function ThemeSwitch() {
  const mounted = useMounted();
  const { theme, setTheme } = useTheme("system");

  if (!mounted) {
    // Same footprint as the icon button below so the header doesn't shift.
    return <Skeleton animationType="pulse" className="size-9 rounded-lg" aria-hidden />;
  }

  const current: ThemeName = THEME_CYCLE.includes(theme as ThemeName)
    ? (theme as ThemeName)
    : "system";
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(current) + 1) % THEME_CYCLE.length];
  const Icon = THEME_ICON[current];

  return (
    <Button
      isIconOnly
      variant="ghost"
      size="sm"
      aria-label={`Theme: ${current}. Switch to ${next}.`}
      onPress={() => setTheme(next)}
    >
      <Icon className="size-4" />
    </Button>
  );
}

export function ThemeToggle() {
  // `theme` is only known client-side, so we gate on `mounted` to keep the
  // server/first-client render identical and avoid a hydration mismatch,
  // matching the pattern in auth-nav.tsx. Crucially, useTheme's own useState
  // initializer already reads localStorage ("heroui-theme" — the same key the
  // blocking script in app/layout.tsx resolves pre-paint) with a "system"
  // fallback, so `theme` holds the real value from the very first client
  // render: once the select appears it shows the right value immediately,
  // never a "System" placeholder that swaps after mount.
  const mounted = useMounted();
  const { theme, setTheme } = useTheme("system");

  if (!mounted) {
    // Same footprint as the trigger below (w-28, min-h-9, rounded-field) so
    // the account card's geometry doesn't shift when the select mounts.
    return <Skeleton animationType="pulse" className="h-9 w-28 rounded-field" aria-hidden />;
  }

  return (
    <Select
      aria-label="Theme"
      selectedKey={theme}
      onSelectionChange={(key) => setTheme(String(key))}
    >
      <Select.Trigger className="w-28">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item id="light">Light</ListBox.Item>
          <ListBox.Item id="dark">Dark</ListBox.Item>
          <ListBox.Item id="system">System</ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
