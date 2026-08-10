/**
 * Optional server PostHog for the worker (federation delivery failures).
 * No-op unless POSTHOG_SERVER_ENABLED + POSTHOG_KEY.
 */
type PostHogClient = {
  capture: (args: {
    distinctId: string;
    event: string;
    properties?: Record<string, unknown>;
  }) => void;
};

let client: PostHogClient | null = null;
let initAttempted = false;
let cachedDistinctId: string | null = null;

async function getPostHog(): Promise<PostHogClient | null> {
  if (initAttempted) return client;
  initAttempted = true;

  if (process.env.POSTHOG_SERVER_ENABLED !== "true" || !process.env.POSTHOG_KEY) {
    return null;
  }

  try {
    const { PostHog } = await import("posthog-node");
    const ph = new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    });
    client = {
      capture: (args) =>
        ph.capture({
          distinctId: args.distinctId,
          event: args.event,
          properties: args.properties,
        }),
    };
    console.log("[posthog] worker server client enabled");
    return client;
  } catch (err) {
    console.error("[posthog] worker init failed", err);
    return null;
  }
}

async function getTelemetryDistinctId(): Promise<string> {
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
    cachedDistinctId = `instance:${process.env.INSTANCE_DOMAIN || "unknown"}`;
    return cachedDistinctId;
  }
}

export async function captureServerEvent(
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const ph = await getPostHog();
    if (!ph) return;
    const id = await getTelemetryDistinctId();
    ph.capture({ distinctId: id, event, properties: properties || {} });
  } catch {
    // never break delivery path
  }
}
