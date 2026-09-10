"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const STORAGE_KEY = "mun-prep-theme";
const THEME_ATTRIBUTE = "data-theme";

type Theme = "light" | "dark";

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : "light";
}

// Apply the persisted theme as soon as the client bundle evaluates, before
// React hydrates, so a dark-mode refresh does not flash the light theme.
if (typeof window !== "undefined" && getStoredTheme() === "dark") {
  document.documentElement.setAttribute(THEME_ATTRIBUTE, "dark");
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Keep React state in sync with the attribute the module scope already set.
  useEffect(() => {
    const current = document.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark" ? "dark" : "light";
    setThemeState(current);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    document.documentElement.setAttribute(THEME_ATTRIBUTE, next);
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(document.documentElement.getAttribute(THEME_ATTRIBUTE) === "dark" ? "light" : "dark");
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}