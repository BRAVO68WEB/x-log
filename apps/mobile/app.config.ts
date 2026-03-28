import type { ExpoConfig } from "expo/config";

const packageJson = require("./package.json") as { version: string };

const config: ExpoConfig = {
  name: "x-log",
  slug: "x-log-mobile",
  version: packageJson.version,
  scheme: "xlog",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  plugins: ["expo-router", "expo-secure-store", "expo-image-picker"],
  experiments: {
    typedRoutes: true,
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.xlog.mobile",
  },
  android: {
    package: "com.xlog.mobile",
  },
  extra: {
    apiBaseUrl:
      process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080/api",
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "836a034c-90d3-446a-a53a-2883714d0b11",
    },
  },
};

export default config;
