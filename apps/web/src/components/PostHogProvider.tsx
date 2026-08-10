"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Optional PostHog. Only loads when NEXT_PUBLIC_POSTHOG_ENABLED=true and key is set.
 * Zero network traffic when disabled.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loaded = useRef(false);

  useEffect(() => {
    const enabled =
      process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "true" ||
      process.env.NEXT_PUBLIC_POSTHOG_ENABLED === "1";
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!enabled || !key || loaded.current) return;

    loaded.current = true;
    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

    import("posthog-js")
      .then(({ default: posthog }) => {
        if (posthog.__loaded) return;
        posthog.init(key, {
          api_host: host,
          capture_pageview: false, // we capture manually on route change
          persistence: "localStorage+cookie",
        });
        (window as any).__xlog_posthog = posthog;
        posthog.capture("$pageview");
      })
      .catch(() => {
        /* optional dep missing */
      });
  }, []);

  useEffect(() => {
    const ph = (window as any).__xlog_posthog;
    if (!ph) return;
    const url =
      pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    ph.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
