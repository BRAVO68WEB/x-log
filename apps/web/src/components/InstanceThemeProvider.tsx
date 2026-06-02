"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyThemeById,
  getThemeOption,
  normalizeThemeId,
  type InstanceThemeId,
} from "@/lib/themes";

interface ThemeContextValue {
  themeId: InstanceThemeId;
  label: string;
}

const InstanceThemeContext = createContext<ThemeContextValue>({
  themeId: "system",
  label: "System",
});

export function InstanceThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<InstanceThemeId>("system");

  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      try {
        const response = await fetch("/api/public/instance", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const summary = (await response.json()) as { theme_id?: unknown };
        if (!cancelled) {
          setThemeId(normalizeThemeId(summary.theme_id));
        }
      } catch {
        if (!cancelled) {
          setThemeId("system");
        }
      }
    }

    void loadTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyThemeById(themeId);

    if (themeId !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemeById("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [themeId]);

  useEffect(() => {
    function handleThemeChanged(event: Event) {
      const detail = (event as CustomEvent<{ themeId?: unknown }>).detail;
      setThemeId(normalizeThemeId(detail?.themeId));
    }

    window.addEventListener("xlog-theme-changed", handleThemeChanged);
    return () => window.removeEventListener("xlog-theme-changed", handleThemeChanged);
  }, []);

  const value = useMemo(() => {
    const theme = getThemeOption(themeId);
    return {
      themeId,
      label: theme.label,
    };
  }, [themeId]);

  return <InstanceThemeContext.Provider value={value}>{children}</InstanceThemeContext.Provider>;
}

export function useInstanceTheme() {
  return useContext(InstanceThemeContext);
}
