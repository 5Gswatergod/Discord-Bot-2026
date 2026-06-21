"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

const themeStorageKey = "hydrava-theme";

type Theme = "light" | "dark";

let transitionTimer: number | undefined;

function applyTheme(theme: Theme, animate: boolean) {
  const root = document.documentElement;

  if (animate) {
    window.clearTimeout(transitionTimer);
    root.classList.add("theme-transition");
    transitionTimer = window.setTimeout(() => root.classList.remove("theme-transition"), 260);
  }

  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeToggle() {
  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncWithSystem = (event: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem(themeStorageKey)) {
          return;
        }
      } catch {
        // Continue following the system preference when storage is unavailable.
      }

      applyTheme(event.matches ? "dark" : "light", true);
    };

    colorScheme.addEventListener("change", syncWithSystem);
    return () => colorScheme.removeEventListener("change", syncWithSystem);
  }, []);

  function toggleTheme() {
    const theme = document.documentElement.classList.contains("dark") ? "light" : "dark";

    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // The theme still applies for this visit when storage is unavailable.
    }
    applyTheme(theme, true);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="relative shrink-0 overflow-hidden"
      onClick={toggleTheme}
      aria-label="切換亮色與暗色模式"
      title="切換亮色與暗色模式"
    >
      <Sun
        className="h-4 w-4 rotate-0 scale-100 transition-transform duration-200 dark:-rotate-90 dark:scale-0"
        aria-hidden="true"
      />
      <Moon
        className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-200 dark:rotate-0 dark:scale-100"
        aria-hidden="true"
      />
    </Button>
  );
}
