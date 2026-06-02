import { getDb } from "./index";
import type { InstanceThemeId } from "./schema";

const themeIds = new Set<InstanceThemeId>([
  "system",
  "xlog-default",
  "blues",
  "marigold",
  "aurora",
  "sunburst",
  "monochrome",
  "mocha",
  "amoled",
  "off-white",
  "dracula",
  "mint-grove",
  "neon-circuit",
  "signal",
  "retro-classic",
]);

function normalizeThemeId(value: string | null | undefined): InstanceThemeId {
  return themeIds.has(value as InstanceThemeId) ? (value as InstanceThemeId) : "system";
}

let cachedSettings: {
  instance_domain: string;
  instance_name: string;
  instance_description: string | null;
  federation_enabled: boolean;
  following_enabled: boolean;
  use_profile_as_landing: boolean;
  theme_id: InstanceThemeId;
} | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

export async function getInstanceSettings() {
  const now = Date.now();

  // Return cached settings if still valid
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL) {
    return cachedSettings;
  }

  const db = getDb();
  let settings: {
    instance_domain: string;
    instance_name: string;
    instance_description: string | null;
    federation_enabled: boolean;
    following_enabled: boolean;
    use_profile_as_landing: boolean;
    theme_id: string;
  } | null;

  try {
    settings =
      (await db
        .selectFrom("instance_settings")
        .select([
          "instance_domain",
          "instance_name",
          "instance_description",
          "federation_enabled",
          "following_enabled",
          "use_profile_as_landing",
          "theme_id",
        ])
        .where("id", "=", 1)
        .executeTakeFirst()) ?? null;
  } catch (error) {
    const dbError = error as { code?: string };
    if (dbError?.code !== "42703") {
      throw error;
    }

    const legacySettings = await db
      .selectFrom("instance_settings")
      .select([
        "instance_domain",
        "instance_name",
        "instance_description",
        "federation_enabled",
        "following_enabled",
      ])
      .where("id", "=", 1)
      .executeTakeFirst();

    if (!legacySettings) {
      settings = null;
    } else {
      settings = {
        ...legacySettings,
        use_profile_as_landing: false,
        theme_id: "system",
      };
    }
  }

  if (!settings) {
    // Fallback to environment variable if settings don't exist yet
    const { getEnv } = await import("@xlog/config");
    const env = getEnv();
    return {
      instance_domain: env.INSTANCE_DOMAIN,
      instance_name: env.INSTANCE_NAME || "x-log",
      instance_description: null,
      federation_enabled: true,
      following_enabled: false,
      use_profile_as_landing: false,
      theme_id: "system",
    };
  }

  cachedSettings = {
    instance_domain: settings.instance_domain,
    instance_name: settings.instance_name,
    instance_description: settings.instance_description,
    federation_enabled: settings.federation_enabled,
    following_enabled: settings.following_enabled,
    use_profile_as_landing: settings.use_profile_as_landing,
    theme_id: normalizeThemeId(settings.theme_id),
  };
  cacheTimestamp = now;

  return cachedSettings;
}

export function clearInstanceSettingsCache() {
  cachedSettings = null;
  cacheTimestamp = 0;
}
