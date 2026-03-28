"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AppLayout, DEFAULT_LAYOUT, isAppLayout, LAYOUTS, LAYOUT_STORAGE_KEY } from "../app/layoutPreference";

type LayoutContextType = {
  layout: AppLayout;
  setLayout: (layout: AppLayout) => void;
  layouts: typeof LAYOUTS;
};

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

const applyLayout = (layout: AppLayout) => {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.layout = layout;
};

const initialLayout = (): AppLayout => {
  if (typeof document === "undefined") {
    return DEFAULT_LAYOUT;
  }

  const booted = document.documentElement.dataset.layout;
  return isAppLayout(booted) ? booted : DEFAULT_LAYOUT;
};

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [layout, setLayoutState] = useState<AppLayout>(initialLayout);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    const nextLayout = isAppLayout(stored) ? stored : DEFAULT_LAYOUT;
    setLayoutState(nextLayout);
    applyLayout(nextLayout);
  }, []);

  const setLayout = (nextLayout: AppLayout) => {
    setLayoutState(nextLayout);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, nextLayout);
    }
    applyLayout(nextLayout);
  };

  const value = useMemo(
    () => ({
      layout,
      setLayout,
      layouts: LAYOUTS
    }),
    [layout]
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
}

