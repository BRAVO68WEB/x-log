import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "xlog.mobile.theme";

export type ThemePreference = "system" | "light" | "dark";

export async function getStoredThemePreference() {
  const value = await AsyncStorage.getItem(THEME_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "system" as ThemePreference;
}

export function setStoredThemePreference(value: ThemePreference) {
  return AsyncStorage.setItem(THEME_KEY, value);
}
