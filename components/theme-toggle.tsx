"use client";

import { ListBox, Select, useTheme } from "@heroui/react";
import { useMounted } from "@/hooks/use-mounted";

export function ThemeToggle() {
  // `theme` is only known client-side (it reads localStorage), so we gate on
  // `mounted` to keep the server/first-client render identical and avoid a
  // hydration mismatch, matching the pattern in auth-nav.tsx.
  const mounted = useMounted();
  const { theme, setTheme } = useTheme("system");

  return (
    <Select
      aria-label="Theme"
      selectedKey={mounted ? theme : "system"}
      onSelectionChange={(key) => setTheme(String(key))}
      isDisabled={!mounted}
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
