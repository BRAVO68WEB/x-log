import Constants from "expo-constants";

export function getConfiguredApiBaseUrl() {
  const baseUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  return (baseUrl || "http://localhost:8080/api").replace(/\/+$/, "");
}
