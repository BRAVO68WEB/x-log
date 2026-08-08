"use client";

import { useEffect, useRef } from "react";

const SESSION_KEY = "xlog_aid";

function getOrCreateSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return `ephemeral-${Date.now()}`;
  }
}

/**
 * Fires a first-party page view when the instance analytics feature is on.
 * No-op when disabled (checked via /api/analytics/status).
 */
export function AnalyticsBeacon({
  path,
  postId,
}: {
  path: string;
  postId?: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    let cancelled = false;

    (async () => {
      try {
        const statusRes = await fetch("/api/analytics/status", {
          credentials: "omit",
        });
        if (!statusRes.ok || cancelled) return;
        const status = (await statusRes.json()) as { enabled?: boolean };
        if (!status.enabled) return;

        await fetch("/api/analytics/collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "omit",
          body: JSON.stringify({
            path,
            post_id: postId || null,
            referrer: typeof document !== "undefined" ? document.referrer || null : null,
            session_id: getOrCreateSessionId(),
          }),
          keepalive: true,
        });
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [path, postId]);

  return null;
}
