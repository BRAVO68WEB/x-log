import { getEnv } from "@xlog/config";

type PostHogClient = {
  capture: (args: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }) => void;
  shutdown: () => Promise<void>;
};

let client: PostHogClient | null = null;
let initAttempted = false;
let cachedDistinctId: string | null = null;

/**
 * Optional server-side PostHog. No-op unless POSTHOG_SERVER_ENABLED + key.
 * Never call with visitor IPs or raw UA from first-party analytics.
 */
export async function getPostHog(): Promise<PostHogClient | null> {
  if (initAttempted) return client;
  initAttempted = true;

  const env = getEnv();
  if (!env.POSTHOG_SERVER_ENABLED || !env.POSTHOG_KEY) {
    return null;
  }

  try {
    const { PostHog } = await import("posthog-node");
    const ph = new PostHog(env.POSTHOG_KEY, {
      host: env.POSTHOG_HOST,
    });
    client = {
      capture: (args) =>
        ph.capture({
          distinctId: args.distinctId,
          event: args.event,
          properties: args.properties,
        }),
      shutdown: () => ph.shutdown(),
    };
    console.log("[posthog] server client enabled");
    return client;
  } catch (err) {
    console.error("[posthog] failed to init server client", err);
    return null;
  }
}

/**
 * Distinct id for instance-level product events:
 * primary user id → instance:{domain} → "instance:unknown"
 */
export async function getTelemetryDistinctId(): Promise<string> {
  if (cachedDistinctId) return cachedDistinctId;
  try {
    const { getPrimaryUser, getInstanceSettings } = await import("@xlog/db");
    const primary = await getPrimaryUser();
    if (primary?.id) {
      cachedDistinctId = primary.id;
      return cachedDistinctId;
    }
    const settings = await getInstanceSettings();
    cachedDistinctId = `instance:${settings.instance_domain || "unknown"}`;
    return cachedDistinctId;
  } catch {
    const env = getEnv();
    cachedDistinctId = `instance:${env.INSTANCE_DOMAIN || "unknown"}`;
    return cachedDistinctId;
  }
}

export async function captureServerEvent(
  event: string,
  properties?: Record<string, unknown>,
  distinctId?: string
): Promise<void> {
  try {
    const ph = await getPostHog();
    if (!ph) return;
    const id = distinctId ?? (await getTelemetryDistinctId());
    // Strip any accidental PII keys
    const safe: Record<string, unknown> = { ...(properties || {}) };
    delete safe.ip;
    delete safe.ip_raw;
    delete safe.user_agent;
    delete safe.userAgent;
    ph.capture({ distinctId: id, event, properties: safe });
  } catch {
    // never break product path
  }
}
