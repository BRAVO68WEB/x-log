/**
 * Simple in-process sliding-window rate limiter.
 * Fine for single-instance API; multi-replica deploys should use Redis later.
 */
import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { getEnv } from "@xlog/config";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

export function checkRateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= opts.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: opts.limit - existing.count,
    retryAfterSec: 0,
  };
}

/**
 * Client address for rate limits.
 * hops <= 0 uses the socket address only.
 * hops >= 1 trusts CF-Connecting-IP, else the X-Forwarded-For entry that
 * many hops back from the right (the proxy-appended client, not the left-most
 * attacker-supplied value). The proxy must strip inbound forwarding headers.
 */
export function clientIpFromProxy(opts: {
  hops: number;
  socketAddress: string;
  cfConnectingIp?: string | null;
  forwardedFor?: string | null;
}): string {
  const socket = opts.socketAddress.trim() || "unknown";
  if (opts.hops <= 0) return socket;
  const cf = opts.cfConnectingIp?.trim();
  if (cf) return cf;
  if (opts.forwardedFor) {
    const parts = opts.forwardedFor
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const idx = parts.length - opts.hops;
    if (idx >= 0 && parts[idx]) return parts[idx];
  }
  return socket;
}

function socketAddress(c: Context): string {
  try {
    const info = getConnInfo(c);
    return info.remote.address?.trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export function clientKeyFromRequest(c: Context): string {
  let hops = 0;
  try {
    hops = getEnv().TRUSTED_PROXY_HOPS;
  } catch {
    hops = 0;
  }
  return clientIpFromProxy({
    hops,
    socketAddress: socketAddress(c),
    cfConnectingIp: c.req.header("cf-connecting-ip"),
    forwardedFor: c.req.header("x-forwarded-for"),
  });
}

// Periodic cleanup of expired buckets
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}, 60_000).unref?.();
