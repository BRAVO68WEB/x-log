// Feature flags with dual control: settings-based + ENV override
// ENV always takes precedence over database settings

export enum Feature {
  CODE_SNIPPETS = "code_snippets",
  LINK_ARCHIVE = "link_archive",
  AI_WRITER = "ai_writer",
  PASSWORD_RESET = "password_reset",
  CUSTOM_POST_META = "custom_post_meta",
  BOOKMARKS = "bookmarks",
  REPOSTS = "reposts",
  THREADS = "threads",
  SHORT_POSTS = "short_posts",
  SCHEDULED_POSTS = "scheduled_posts",
  TRENDING = "trending",
  ANALYTICS = "analytics",
  DMS = "dms",
  CUSTOM_THEMES = "custom_themes",
}

export const FEATURE_ENV_PREFIX = "FEATURE_";

interface FeatureCache {
  value: boolean | null;
  timestamp: number;
}

const featureCache = new Map<Feature, FeatureCache>();
const CACHE_TTL = 60000; // 1 minute cache

export function getFeatureEnvKey(feature: Feature): string {
  return `${FEATURE_ENV_PREFIX}${feature.toUpperCase()}`;
}

export function getFeatureSettingKey(feature: Feature): string {
  return `feature_${feature}`;
}

export function isFeatureEnabled(feature: Feature): boolean {
  const now = Date.now();
  const cached = featureCache.get(feature);

  // Check cache first
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.value ?? false;
  }

  // ENV always wins
  const envKey = getFeatureEnvKey(feature);
  const envValue = process.env[envKey];
  if (envValue !== undefined) {
    const enabled = envValue === "true";
    featureCache.set(feature, { value: enabled, timestamp: now });
    return enabled;
  }

  // Database setting (handled async in the async version)
  // For sync checks, we default to false unless set
  return false;
}

// Async version for use in API routes
export async function isFeatureEnabledAsync(feature: Feature): Promise<boolean> {
  const now = Date.now();
  const cached = featureCache.get(feature);

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.value ?? false;
  }

  // ENV always wins
  const envKey = getFeatureEnvKey(feature);
  const envValue = process.env[envKey];
  if (envValue !== undefined) {
    const enabled = envValue === "true";
    featureCache.set(feature, { value: enabled, timestamp: now });
    return enabled;
  }

  // Fall back to database settings from feature_flags table
  try {
    const { getDb } = await import("@xlog/db");
    const db = getDb();

    const setting = await db
      .selectFrom("feature_flags")
      .select("enabled")
      .where("feature", "=", feature)
      .executeTakeFirst();

    const enabled = setting?.enabled ?? false;
    featureCache.set(feature, { value: enabled, timestamp: now });
    return enabled;
  } catch {
    // If DB query fails, default to false
    featureCache.set(feature, { value: false, timestamp: now });
    return false;
  }
}

export function clearFeatureCache(): void {
  featureCache.clear();
}

export function clearFeatureCacheFor(feature: Feature): void {
  featureCache.delete(feature);
}

// Check if ENV override is active for a feature
export function isEnvOverrideActive(feature: Feature): boolean {
  const envKey = getFeatureEnvKey(feature);
  return process.env[envKey] !== undefined;
}

// Get all feature states (for admin UI)
export async function getAllFeatureStates(): Promise<
  Array<{
    feature: Feature;
    enabled: boolean;
    envOverride: boolean;
    envValue: string | undefined;
  }>
> {
  const results = await Promise.all(
    Object.values(Feature).map(async (feature) => ({
      feature,
      enabled: await isFeatureEnabledAsync(feature),
      envOverride: isEnvOverrideActive(feature),
      envValue: process.env[getFeatureEnvKey(feature)],
    }))
  );
  return results;
}
