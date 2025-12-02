import { getDb } from "./index";

let cachedSettings: {
  instance_domain: string;
  instance_name: string;
  instance_description: string | null;
  open_registrations: boolean;
  federation_enabled: boolean;
} | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute cache

export async function getInstanceSettings() {
  const now = Date.now();
  
  // Return cached settings if still valid
  if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedSettings;
  }

  const db = getDb();
  const settings = await db
    .selectFrom("instance_settings")
    .select([
      "instance_domain",
      "instance_name",
      "instance_description",
      "open_registrations",
      "federation_enabled",
    ])
    .where("id", "=", 1)
    .executeTakeFirst();

  if (!settings) {
    // Fallback to environment variable if settings don't exist yet
    const { getEnv } = await import("@xlog/config");
    const env = getEnv();
    return {
      instance_domain: env.INSTANCE_DOMAIN,
      instance_name: env.INSTANCE_NAME || "x-log",
      instance_description: null,
      open_registrations: false,
      federation_enabled: true,
    };
  }

  cachedSettings = {
    instance_domain: settings.instance_domain,
    instance_name: settings.instance_name,
    instance_description: settings.instance_description,
    open_registrations: settings.open_registrations,
    federation_enabled: settings.federation_enabled,
  };
  cacheTimestamp = now;

  return cachedSettings;
}

export function clearInstanceSettingsCache() {
  cachedSettings = null;
  cacheTimestamp = 0;
}

