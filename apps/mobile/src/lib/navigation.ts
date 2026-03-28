import type { Href } from "expo-router";

export function sanitizeRedirect(input?: string | string[]): Href {
  const value = typeof input === "string" ? input : undefined;
  if (!value) {
    return "/(tabs)/feed";
  }

  if (
    value === "/(tabs)/feed" ||
    value === "/(tabs)/create" ||
    value === "/(tabs)/you" ||
    value.startsWith("/post/")
  ) {
    return value as Href;
  }

  return "/(tabs)/feed";
}
