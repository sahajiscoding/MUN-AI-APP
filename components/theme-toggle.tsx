"use client";

import { Moon, Sun, SunDim } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "system" | "dark";

const SEGMENTS: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
  { mode: "light", label: "Light mode", icon: Sun },
  { mode: "system", label: "Follow system theme", icon: SunDim },
  { mode: "dark", label: "Dark mode", icon: Moon },
];

// 24px segments abutting inside a 2px-padded track: the knob advances exactly
// one segment width per step, so it always lands on the chosen mode.
const SEGMENT_PX = 24;

/** Narrow rails get a single cycling button, which cannot overflow. */
function CompactThemeToggle({ className }: { className?: string }) {
  const { theme, effectiveTheme, setTheme } = useTheme();
  const activeIndex = Math.max(0, SEGMENTS.findIndex((segment) => segment.mode === theme));
  const current = SEGMENTS[activeIndex];
  const next = SEGMENTS[(activeIndex + 1) % SEGMENTS.length];
  const CurrentIcon = current.icon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next.mode)}
      title={`Appearance: ${describe(theme, effectiveTheme)}. Switch to ${next.label.toLowerCase()}.`}
      aria-label={`Appearance: ${describe(theme, effectiveTheme)}. Activate to switch to ${next.label}.`}
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
  const { theme, effectiveTheme, setTheme } = useTheme();
  const activeIndex = Math.max(0, SEGMENTS.findIndex((segment) => segment.mode === theme));

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
      {SEGMENTS.map((segment) => {
        const active = segment.mode === theme;
        const Icon = segment.icon;
        const label =
          segment.mode === "system" && theme === "system"
            ? `${segment.label} (currently ${effectiveTheme})`
            : segment.label;

        return (
          <button
            key={segment.mode}
            type="button"
            onClick={() => setTheme(segment.mode)}
            aria-pressed={active}
            title={label}
            aria-label={label}
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

function describe(mode: ThemeMode, effectiveTheme: string) {
  return mode === "system" ? `system (${effectiveTheme})` : mode;
}

/**
 * Appearance picker: Light / System / Dark, with the active mode shown by a
 * sliding knob. Below `sm` it collapses to a single cycling button so it can
 * never overflow a narrow header or rail. Pass `compact` to force the small
 * button at every size.
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
