// Client-side feature flags using NEXT_PUBLIC_ prefixed env vars
// For server-side checks, use the API's isFeatureEnabledAsync

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

const FEATURE_ENV_PREFIX = "NEXT_PUBLIC_FEATURE_";

function getEnvKey(feature: Feature): string {
  return `${FEATURE_ENV_PREFIX}${feature.toUpperCase()}`;
}

// Check if a feature is enabled (client-side)
// Returns true if NEXT_PUBLIC_FEATURE_X=true, false otherwise
export function isFeatureEnabled(feature: Feature): boolean {
  const envValue = process.env[getEnvKey(feature)];
  return envValue === "true";
}

// Check if ENV override is active (for admin UI)
export function isEnvOverrideActive(feature: Feature): boolean {
  const envKey = getEnvKey(feature);
  return process.env[envKey] !== undefined;
}

// Get all feature states (for admin UI)
export function getAllFeatureStates(): Array<{
  feature: Feature;
  enabled: boolean;
  envOverride: boolean;
  envValue: string | undefined;
}> {
  return Object.values(Feature).map((feature) => ({
    feature,
    enabled: isFeatureEnabled(feature),
    envOverride: isEnvOverrideActive(feature),
    envValue: process.env[getEnvKey(feature)],
  }));
}

// Individual feature exports for convenience
export const features = {
  codeSnippets: isFeatureEnabled(Feature.CODE_SNIPPETS),
  linkArchive: isFeatureEnabled(Feature.LINK_ARCHIVE),
  aiWriter: isFeatureEnabled(Feature.AI_WRITER),
  passwordReset: isFeatureEnabled(Feature.PASSWORD_RESET),
  customPostMeta: isFeatureEnabled(Feature.CUSTOM_POST_META),
  bookmarks: isFeatureEnabled(Feature.BOOKMARKS),
  reposts: isFeatureEnabled(Feature.REPOSTS),
  threads: isFeatureEnabled(Feature.THREADS),
  shortPosts: isFeatureEnabled(Feature.SHORT_POSTS),
  scheduledPosts: isFeatureEnabled(Feature.SCHEDULED_POSTS),
  trending: isFeatureEnabled(Feature.TRENDING),
  analytics: isFeatureEnabled(Feature.ANALYTICS),
  dms: isFeatureEnabled(Feature.DMS),
  customThemes: isFeatureEnabled(Feature.CUSTOM_THEMES),
};
