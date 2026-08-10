import { Context, Next } from "hono";
import { checkRateLimit, clientKeyFromRequest, type RateLimitResult } from "../lib/rate-limit";

/**
 * Global + path-specific rate limiting (in-process).
 * Disable with RATE_LIMIT_ENABLED=false.
 *
 * Env overrides (optional):
 * - RATE_LIMIT_API_MAX (default 600)
 * - RATE_LIMIT_API_WINDOW_MS (default 60000)
 */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function isEnabled(): boolean {
  return process.env.RATE_LIMIT_ENABLED !== "false";
}

export type RateLimitRule = {
  /** Unique bucket prefix (IP is appended). */
  key: string;
  limit: number;
  windowMs: number;
  match: (path: string, method: string) => boolean;
};

/** Stricter rules evaluated before the global API bucket. */
export const SENSITIVE_RATE_LIMIT_RULES: RateLimitRule[] = [
  {
    key: "auth-login",
    limit: 20,
    windowMs: 15 * 60 * 1000,
    match: (path, method) =>
      method === "POST" && (path === "/api/auth/login" || path.endsWith("/auth/login")),
  },
  {
    key: "auth-mobile",
    limit: 20,
    windowMs: 15 * 60 * 1000,
    match: (path, method) =>
      method === "POST" && path.includes("/auth/mobile/login"),
  },
  {
    key: "auth-forgot",
    limit: 10,
    windowMs: 60 * 60 * 1000,
    match: (path, method) =>
      method === "POST" &&
      (path.includes("/auth/forgot-password") || path.endsWith("/forgot-password")),
  },
  {
    key: "auth-reset",
    limit: 20,
    windowMs: 60 * 60 * 1000,
    match: (path, method) =>
      method === "POST" &&
      (path.includes("/auth/reset-password") || path.endsWith("/reset-password")),
  },
  {
    key: "analytics-collect",
    limit: 120,
    windowMs: 60 * 1000,
    match: (path, method) => method === "POST" && path.includes("/analytics/collect"),
  },
  {
    key: "media-upload",
    limit: 60,
    windowMs: 60 * 1000,
    match: (path, method) => method === "POST" && path.includes("/media/upload"),
  },
];

function globalApiLimit(): { limit: number; windowMs: number } {
  return {
    limit: envInt("RATE_LIMIT_API_MAX", 600),
    windowMs: envInt("RATE_LIMIT_API_WINDOW_MS", 60_000),
  };
}

function setRateLimitHeaders(
  c: Context,
  limit: number,
  result: RateLimitResult
) {
  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(Math.max(0, result.remaining)));
  if (!result.ok && result.retryAfterSec > 0) {
    c.header("Retry-After", String(result.retryAfterSec));
  }
}

/**
 * Apply a single bucket. Returns a 429 Response when blocked, else null.
 */
export function enforceRateLimit(
  c: Context,
  bucketKey: string,
  opts: { limit: number; windowMs: number }
): Response | null {
  const result = checkRateLimit(bucketKey, opts);
  setRateLimitHeaders(c, opts.limit, result);
  if (result.ok) return null;
  return c.json(
    {
      error: `Too many requests. Retry in ${result.retryAfterSec}s`,
      retry_after_sec: result.retryAfterSec,
    },
    429
  );
}

/**
 * Middleware for API + a few high-traffic public surfaces.
 * Skips health and static well-known GETs so probes stay cheap.
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  if (!isEnabled()) {
    return next();
  }

  const path = c.req.path;
  const method = c.req.method.toUpperCase();

  if (path === "/health" || path === "/docs" || path === "/api/openapi.json") {
    return next();
  }

  // Discovery endpoints: skip (high fan-out, low abuse surface)
  if (
    method === "GET" &&
    (path.startsWith("/.well-known/") ||
      path === "/nodeinfo/2.0" ||
      path.startsWith("/users/") ||
      path.startsWith("/@"))
  ) {
    return next();
  }

  const ip = clientKeyFromRequest(c);

  for (const rule of SENSITIVE_RATE_LIMIT_RULES) {
    if (rule.match(path, method)) {
      const blocked = enforceRateLimit(c, `${rule.key}:${ip}`, {
        limit: rule.limit,
        windowMs: rule.windowMs,
      });
      if (blocked) return blocked;
    }
  }

  // Global per-IP API budget
  if (path.startsWith("/api/") || path === "/api") {
    const g = globalApiLimit();
    const blocked = enforceRateLimit(c, `api-global:${ip}`, g);
    if (blocked) return blocked;
  }

  // Soft limit MCP streamable / jsonrpc
  if (path.startsWith("/mcp") || path.startsWith("/api/mcp")) {
    const blocked = enforceRateLimit(c, `mcp:${ip}`, {
      limit: envInt("RATE_LIMIT_MCP_MAX", 180),
      windowMs: 60_000,
    });
    if (blocked) return blocked;
  }

  // Soft limit federation inbox posts (many peers, but still cap abuse)
  if (method === "POST" && (path.includes("/inbox") || path.endsWith("/inbox"))) {
    const blocked = enforceRateLimit(c, `ap-inbox:${ip}`, {
      limit: envInt("RATE_LIMIT_INBOX_MAX", 240),
      windowMs: 60_000,
    });
    if (blocked) return blocked;
  }

  return next();
}
