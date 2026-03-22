"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppTheme, DEFAULT_THEME, isDarkTheme, THEMES, THEME_STORAGE_KEY } from "../app/theme";

type ThemeContextType = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  themes: typeof THEMES;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const applyTheme = (theme: AppTheme) => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", isDarkTheme(theme));
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(DEFAULT_THEME);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as AppTheme | null;
    const nextTheme = THEMES.some((item) => item.id === storedTheme) ? storedTheme! : DEFAULT_THEME;
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const setTheme = (nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    }
    applyTheme(nextTheme);
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      themes: THEMES
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
