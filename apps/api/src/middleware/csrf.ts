import { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { timingSafeEqual } from "crypto";
import { getEnv } from "@xlog/config";

/** Must match session cookie name in session.ts (avoid circular import). */
const SESSION_COOKIE_NAME = "xlog_session";
const CSRF_MAX_AGE = 60 * 60 * 24 * 7; // 7 days — align with session

/** Readable by JS so the SPA can double-submit via header. */
export const CSRF_COOKIE_NAME = "xlog_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

export function setCsrfCookie(c: Context, token?: string): string {
  const value = token ?? generateCsrfToken();
  setCookie(c, CSRF_COOKIE_NAME, value, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: CSRF_MAX_AGE,
    path: "/",
  });
  return value;
}

export function clearCsrfCookie(c: Context) {
  deleteCookie(c, CSRF_COOKIE_NAME, { path: "/" });
}

function tokensMatch(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Hostnames (no port) trusted for Origin / Referer checks. */
export function getTrustedCsrfHosts(): Set<string> {
  const env = getEnv();
  const hosts = new Set<string>();

  const addHost = (raw: string | undefined | null) => {
    if (!raw) return;
    try {
      const withScheme = raw.includes("://") ? raw : `https://${raw}`;
      const u = new URL(withScheme);
      hosts.add(u.hostname.toLowerCase());
    } catch {
      const bare = raw.replace(/^https?:\/\//, "").split("/")[0]?.split(":")[0];
      if (bare) hosts.add(bare.toLowerCase());
    }
  };

  addHost(env.INSTANCE_DOMAIN);
  addHost(env.OIDC_REDIRECT_URI);
  addHost(env.NEXT_PUBLIC_API_URL);

  if (env.NODE_ENV !== "production") {
    hosts.add("localhost");
    hosts.add("127.0.0.1");
    hosts.add("0.0.0.0");
  }

  return hosts;
}

export function hostnameFromUrl(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Exported for unit tests. */
export function csrfTokensMatch(a: string, b: string): boolean {
  return tokensMatch(a, b);
}

/**
 * Origin / Referer host must be trusted when either header is present.
 * In production, missing both is rejected (browsers send Origin on CORS-like POSTs).
 */
export function isTrustedCsrfOrigin(c: Context): boolean {
  const trusted = getTrustedCsrfHosts();
  const origin = c.req.header("origin");
  const referer = c.req.header("referer");

  if (origin) {
    const host = hostnameFromUrl(origin);
    return host !== null && trusted.has(host);
  }

  if (referer) {
    const host = hostnameFromUrl(referer);
    return host !== null && trusted.has(host);
  }

  // Same-origin navigations sometimes omit Origin; double-submit still required.
  // Reject in production when neither hint is present.
  return getEnv().NODE_ENV !== "production";
}

/**
 * CSRF protection for cookie-session mutating requests.
 *
 * Skips:
 * - Safe methods (GET/HEAD/OPTIONS)
 * - Bearer Authorization (mobile, MCP, API clients)
 * - Requests without a session cookie (public login/register/collect)
 *
 * Enforces when `xlog_session` is present:
 * 1. Trusted Origin or Referer (production)
 * 2. Double-submit: cookie `xlog_csrf` === header `X-CSRF-Token`
 */
export async function csrfMiddleware(c: Context, next: Next) {
  const method = c.req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) {
    return next();
  }

  const auth = c.req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return next();
  }

  const sessionCookie = getCookie(c, SESSION_COOKIE_NAME);
  if (!sessionCookie) {
    return next();
  }

  if (!isTrustedCsrfOrigin(c)) {
    return c.json({ error: "CSRF validation failed: untrusted origin" }, 403);
  }

  const cookieToken = getCookie(c, CSRF_COOKIE_NAME);
  const headerToken = c.req.header(CSRF_HEADER_NAME) ?? c.req.header("X-CSRF-Token");

  if (!cookieToken || !headerToken || !csrfTokensMatch(cookieToken, headerToken)) {
    return c.json({ error: "CSRF validation failed: token mismatch" }, 403);
  }

  return next();
}
