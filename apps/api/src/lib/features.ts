import { getDb } from "@xlog/db";

export const FEATURE_KEYS = [
  "code_snippets",
  "link_archive",
  "ai_writer",
  "password_reset",
  "custom_post_meta",
  "bookmarks",
  "reposts",
  "threads",
  "short_posts",
  "scheduled_posts",
  "trending",
  "analytics",
  "dms",
  "custom_themes",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

interface CachedFeature {
  enabled: boolean;
  envOverride: boolean;
  envValue: string | null;
}

let featureCache: Map<string, CachedFeature> | null = null;
let featureCacheTimestamp = 0;
const FEATURE_CACHE_TTL = 30_000; // 30 seconds

function readEnvOverride(key: string): string | undefined {
  const envKey = `FEATURE_${key.toUpperCase()}`;
  return process.env[envKey];
}

export async function isFeatureEnabled(feature: string): Promise<boolean> {
  const envValue = readEnvOverride(feature);
  if (envValue !== undefined) {
    return envValue === "true";
  }

  const features = await getAllFeatures();
  const entry = features.get(feature);
  return entry?.enabled ?? false;
}

export async function getFeatureStatus(feature: string): Promise<CachedFeature> {
  const envValue = readEnvOverride(feature);
  if (envValue !== undefined) {
    return {
      enabled: envValue === "true",
      envOverride: true,
      envValue,
    };
  }

  const features = await getAllFeatures();
  return (
    features.get(feature) ?? {
      enabled: false,
      envOverride: false,
      envValue: null,
    }
  );
}

export async function getAllFeatures(): Promise<Map<string, CachedFeature>> {
  const now = Date.now();
  if (featureCache && now - featureCacheTimestamp < FEATURE_CACHE_TTL) {
    return featureCache;
  }

  const db = getDb();
  const rows = await db
    .selectFrom("feature_flags")
    .select(["key", "enabled"])
    .execute();

  const map = new Map<string, CachedFeature>();
  for (const row of rows) {
    const envValue = readEnvOverride(row.key);
    map.set(row.key, {
      enabled: envValue !== undefined ? envValue === "true" : row.enabled,
      envOverride: envValue !== undefined,
      envValue: envValue ?? null,
    });
  }

  featureCache = map;
  featureCacheTimestamp = now;
  return map;
}

export async function setFeatureEnabled(
  feature: string,
  enabled: boolean
): Promise<void> {
  const db = getDb();
  await db
    .updateTable("feature_flags")
    .set({ enabled, updated_at: new Date() })
    .where("key", "=", feature)
    .execute();

  // Invalidate cache
  featureCache = null;
  featureCacheTimestamp = 0;
}

export function clearFeatureCache(): void {
  featureCache = null;
  featureCacheTimestamp = 0;
}
