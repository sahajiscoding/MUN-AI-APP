"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "mun-prep-theme";
const THEME_ATTRIBUTE = "data-theme";

type Theme = "light" | "dark" | "system";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" || stored === "light" || stored === "system" ? stored : "light";
}

// Apply the theme as soon as the client bundle evaluates, before React
// hydrates, so a refresh does not flash the wrong mode and auto-dark users
// do not see a flash of light.
(function applyPreHydrationTheme() {
  if (typeof window === "undefined") return;
  const stored = getStoredTheme();
  if (stored === "dark") {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, "dark");
    return;
  }
  if (stored === "light") {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, "light");
    return;
  }
  if (stored === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, "dark");
  }
})();

type ThemeContextValue = {
  theme: Theme;
  effectiveTheme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const mountedRef = useRef(false);

  // Keep React state in sync with the attribute the module scope already set.
  useEffect(() => {
    mountedRef.current = true;
    const currentAttr = document.documentElement.getAttribute(THEME_ATTRIBUTE);
    if (currentAttr === "dark" || currentAttr === "light") {
      setThemeState(currentAttr);
    } else {
      setThemeState(getStoredTheme());
    }
  }, []);

  // If the user chose "system", follow the OS preference and keep the
  // resolved attribute in sync when it changes.
  useEffect(() => {
    const stored = mountedRef.current ? theme : getStoredTheme();
    if (stored !== "system") return;

    const media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (!media) return;

    function applyNow() {
      const next = media.matches ? "dark" : "light";
      if (mountedRef.current) {
        document.documentElement.setAttribute(THEME_ATTRIBUTE, next);
      }
    }

    applyNow();
    media.addEventListener("change", applyNow);
    return () => { media.removeEventListener("change", applyNow); };
  }, [theme]);

  // Resolve what the user actually sees right now: explicit light/dark, or the
  // OS preference when the user picked "system". This is computed outside of
  // render (from the latest state) so the ref is never read during render.
  const effectiveTheme = useResolvedEffectiveTheme(theme);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, next);
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(
      document.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark"
        ? "light"
        : "dark"
    );
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function useResolvedEffectiveTheme(raw: Theme): Theme {
  // On the server (or before mount) fall back to the stored choice without
  // reading window.matchMedia. After mount, resolve "system" against the OS.
  if (raw !== "system") return raw;
  if (typeof window === "undefined") return getStoredTheme();
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
  } catch {
    // If matchMedia is unavailable/unstable, default to light.
  }
  return "light";
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
