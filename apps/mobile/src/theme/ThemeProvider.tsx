import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import {
  getThemeOption,
  getThemeTokens,
  normalizeThemeId,
  type InstanceThemeId,
} from "./palettes";
import type { ThemeTokens } from "./tokens";

interface ThemeContextValue {
  themePreference: InstanceThemeId;
  resolvedTheme: "light" | "dark";
  colors: ThemeTokens;
  isReady: boolean;
  setThemePreference: (value: InstanceThemeId) => Promise<void>;
  setInstanceThemeId: (value: InstanceThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemTheme = useColorScheme();
  const [themePreference, setThemePreferenceState] =
    useState<InstanceThemeId>("system");
  const [isReady] = useState(true);

  const setThemePreference = useCallback(async (next: InstanceThemeId) => {
    setThemePreferenceState(normalizeThemeId(next));
  }, []);

  const setInstanceThemeId = useCallback((next: InstanceThemeId) => {
    setThemePreferenceState(normalizeThemeId(next));
  }, []);

  const systemResolvedTheme = systemTheme === "dark" ? "dark" : "light";
  const themeOption = getThemeOption(themePreference);

  const resolvedTheme =
    themeOption.appearance === "system"
      ? systemResolvedTheme
      : themeOption.appearance;

  const colors = getThemeTokens(themePreference, systemResolvedTheme);

  const value = useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      colors,
      isReady,
      setThemePreference,
      setInstanceThemeId,
    }),
    [
      colors,
      isReady,
      resolvedTheme,
      setInstanceThemeId,
      setThemePreference,
      themePreference,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
