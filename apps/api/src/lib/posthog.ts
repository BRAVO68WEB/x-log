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

/**
 * Optional server-side PostHog. No-op unless POSTHOG_SERVER_ENABLED + key.
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

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const ph = await getPostHog();
  ph?.capture({ distinctId, event, properties });
}
