"use client";

import { Moon, Sun, SunDim } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Segmented appearance picker: three real buttons in left→middle→right order,
 * each pressing to choose Light, System, or Dark. The active segment is
 * visually obvious and its accessible state reflects the actual chosen mode.
 * The underlying theme values, persistence, and OS-following logic are
 * unchanged.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const activeMode = theme;

  const segments: Array<{
    mode: "light" | "system" | "dark";
    label: string;
    pressedLabel: string;
    icon: React.ReactNode;
    activeOffset: string;
  }> = [
    {
      mode: "light",
      label: "Light mode",
      pressedLabel: "Light mode is selected",
      icon: <Sun className="h-3.5 w-3.5" aria-hidden="true" />,
      activeOffset: "translate-x-0",
    },
    {
      mode: "system",
      label: "Follow system theme",
      pressedLabel: effectiveTheme === "dark"
        ? "System theme is selected; your OS is set to dark"
        : effectiveTheme === "light"
          ? "System theme is selected; your OS is set to light"
          : "System theme is selected",
      icon: <SunDim className="h-3.5 w-3.5" aria-hidden="true" />,
      activeOffset: "translate-x-7",
    },
    {
      mode: "dark",
      label: "Dark mode",
      pressedLabel: "Dark mode is selected",
      icon: <Moon className="h-3.5 w-3.5" aria-hidden="true" />,
      activeOffset: "translate-x-14",
    },
  ];

  return (
    <div className={cn("inline-flex", className)} role="group" aria-label="Appearance">
      {segments.map((segment) => {
        const active = activeMode === segment.mode;
        return (
          <button
            key={segment.mode}
            type="button"
            role="button"
            aria-pressed={active}
            aria-label={active ? segment.pressedLabel : segment.label}
            onClick={() => setTheme(segment.mode)}
            className={cn(
              "relative flex h-7 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--control-bg)] shadow-sm backdrop-blur-sm transition-colors duration-300 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgba(29,111,104,0.35)]",
              active
                ? "ring-2 ring-[var(--patina)] ring-offset-1 ring-offset-[var(--paper)]"
                : "hover:bg-[var(--control-bg-strong)]"
            )}
          >
            <span className="pointer-events-none absolute left-1.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true">
              {segment.mode === "dark" ? <Moon aria-hidden="true" /> : segment.mode === "light" ? <Sun aria-hidden="true" /> : <SunDim aria-hidden="true" />}
            </span>
            {active && (
              <span
                className={cn(
                  "absolute left-0.5 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper-strong)] shadow-[0_2px_8px_rgba(23,20,18,0.35)] transition-transform duration-[250ms] ease-out",
                  segment.activeOffset
                )}
              >
                {segment.mode === "system" ? (effectiveTheme === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />) : segment.icon}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}