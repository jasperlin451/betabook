import type { Preview } from "@storybook/nextjs-vite";
import { useLayoutEffect } from "react";

import "@/app/globals.css";
import "./fonts.css";

const preview: Preview = {
  initialGlobals: { theme: "light" },
  globalTypes: {
    theme: {
      description: "Betabook appearance",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Paper (light)" },
          { value: "dark", title: "Ink (dark)" },
        ],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    options: {
      storySort: {
        method: "alphabetical",
        order: ["Foundations", "Components", "Patterns", "Internal"],
      },
    },
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    chromatic: {
      prefersReducedMotion: "reduce",
      modes: {
        "paper desktop": { theme: "light", viewport: { width: 1024, height: 900 } },
        "ink desktop": { theme: "dark", viewport: { width: 1024, height: 900 } },
        "paper mobile": { theme: "light", viewport: { width: 375, height: 812 } },
        "ink mobile": { theme: "dark", viewport: { width: 375, height: 812 } },
      },
    },
  },
  decorators: [
    function AppTheme(Story, context) {
      const theme = context.globals.theme === "dark" ? "dark" : "light";
      useLayoutEffect(() => {
        const html = document.documentElement;
        html.classList.remove("light", "dark");
        html.classList.add(theme);
        html.dataset.theme = theme;
        html.lang = "en";
        return () => {
          html.classList.remove(theme);
          delete html.dataset.theme;
        };
      }, [theme]);
      return (
        <main className="min-h-screen bg-background p-4 font-sans text-foreground antialiased">
          <div className="mx-auto max-w-3xl">
            <Story />
          </div>
        </main>
      );
    },
  ],
};

export default preview;
