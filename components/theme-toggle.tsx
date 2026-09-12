"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

// 24px segments abutting inside a 2px-padded track: the knob advances exactly
// one segment width per step, so it always lands on the chosen mode.
const SEGMENT_PX = 24;

/** Narrow rails get a single button, which cannot overflow. */
function CompactThemeToggle({ className }: { className?: string }) {
  const { effectiveTheme, setTheme } = useTheme();
  const isDark = effectiveTheme === "dark";
  const next = isDark ? "light" : "dark";
  const CurrentIcon = isDark ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Appearance: ${isDark ? "dark" : "light"} mode. Switch to ${next} mode.`}
      aria-label={`Appearance: ${isDark ? "Dark" : "Light"} mode. Switch to ${next} mode.`}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] bg-[var(--control-bg)] text-[var(--muted)] shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--control-bg-strong)] hover:text-[var(--ink)]",
        className
      )}
    >
      <CurrentIcon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}

function SegmentedThemeToggle({ className }: { className?: string }) {
  const { effectiveTheme, setTheme } = useTheme();
  const segments = [
    { mode: "light" as const, label: "Light mode", Icon: Sun },
    { mode: "dark" as const, label: "Dark mode", Icon: Moon },
  ];
  // While the stored preference is still the OS default, the knob marks
  // whichever mode the OS resolves to, so the control never reads as unset.
  const activeIndex = effectiveTheme === "dark" ? 1 : 0;

  return (
    <div
      role="group"
      aria-label="Appearance"
      className={cn(
        "relative inline-flex h-7 shrink-0 items-center rounded-full border border-[var(--line)] bg-[var(--control-bg)] p-0.5 shadow-sm backdrop-blur-sm",
        className
      )}
    >
      {/* One knob slides behind the icons to mark the chosen mode. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-[var(--ink)] shadow-[0_2px_8px_rgba(23,20,18,0.35)] transition-transform duration-[250ms] ease-out"
        style={{ transform: `translateX(${activeIndex * SEGMENT_PX}px)` }}
      />
      {segments.map((segment, index) => {
        const active = index === activeIndex;
        const Icon = segment.Icon;

        return (
          <button
            key={segment.mode}
            type="button"
            onClick={() => setTheme(segment.mode)}
            aria-pressed={active}
            title={segment.label}
            aria-label={segment.label}
            className={cn(
              "relative z-10 grid h-6 w-6 place-items-center rounded-full transition-colors",
              active ? "text-[var(--paper-strong)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Appearance picker: Light or Dark, with the active mode shown by a sliding
 * knob. Below `sm` it collapses to a single button so it can never overflow a
 * narrow header or rail. Pass `compact` to force the small button at any size.
 *
 * A first-time visitor still follows their OS preference until they choose a
 * mode; once they do, that explicit choice wins.
 */
export function ThemeToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) return <CompactThemeToggle className={className} />;

  return (
    <>
      <CompactThemeToggle className={cn("sm:hidden", className)} />
      <SegmentedThemeToggle className={cn("hidden sm:inline-flex", className)} />
    </>
  );
}
