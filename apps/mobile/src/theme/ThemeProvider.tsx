import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import {
  getStoredThemePreference,
  setStoredThemePreference,
  type ThemePreference,
} from "./storage";
import { darkTheme, lightTheme, type ThemeTokens } from "./tokens";

interface ThemeContextValue {
  themePreference: ThemePreference;
  resolvedTheme: "light" | "dark";
  colors: ThemeTokens;
  isReady: boolean;
  setThemePreference: (value: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemTheme = useColorScheme();
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>("system");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    try {
      const stored = await getStoredThemePreference();
      setThemePreferenceState(stored);
    } finally {
      setIsReady(true);
    }
  }

  async function setThemePreference(next: ThemePreference) {
    setThemePreferenceState(next);
    await setStoredThemePreference(next);
  }

  const resolvedTheme =
    themePreference === "system"
      ? systemTheme === "dark"
        ? "dark"
        : "light"
      : themePreference;

  const colors = resolvedTheme === "dark" ? darkTheme : lightTheme;

  const value = useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      colors,
      isReady,
      setThemePreference,
    }),
    [colors, isReady, resolvedTheme, themePreference]
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
