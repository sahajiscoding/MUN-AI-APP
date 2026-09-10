"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Pill-shaped Light/Dark switch: a rounded track showing both a sun and a moon,
 * with an opaque sliding knob (250ms) that carries the icon of the active mode.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggleTheme}
      className={cn(
        "relative h-7 w-14 shrink-0 rounded-full border border-[var(--line)] bg-[var(--control-bg)] shadow-sm backdrop-blur-sm transition-colors duration-300 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(29,111,104,0.35)]",
        className
      )}
    >
      <Sun className="pointer-events-none absolute left-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
      <Moon className="pointer-events-none absolute right-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
      <span
        className={cn(
          "absolute left-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper-strong)] shadow-[0_2px_8px_rgba(23,20,18,0.35)] transition-transform duration-[250ms] ease-out",
          dark ? "translate-x-7" : "translate-x-0"
        )}
      >
        {dark ? <Moon className="h-3.5 w-3.5" aria-hidden="true" /> : <Sun className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>
    </button>
  );
}