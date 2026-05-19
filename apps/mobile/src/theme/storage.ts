import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeThemeId, type InstanceThemeId } from "./palettes";

const THEME_KEY = "xlog.mobile.theme";

export type ThemePreference = InstanceThemeId;

export async function getStoredThemePreference() {
  const value = await AsyncStorage.getItem(THEME_KEY);
  return normalizeThemeId(value);
}

export function setStoredThemePreference(value: ThemePreference) {
  return AsyncStorage.setItem(THEME_KEY, value);
}
