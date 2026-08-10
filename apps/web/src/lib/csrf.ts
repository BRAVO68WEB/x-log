/**
 * Browser CSRF helpers (double-submit cookie).
 * Cookie `xlog_csrf` is set by the API on login; send it as `X-CSRF-Token`
 * on cookie-authenticated mutating requests.
 */

export const CSRF_COOKIE_NAME = "xlog_csrf";
export const CSRF_HEADER_NAME = "X-CSRF-Token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const part of cookies) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq);
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return null;
}

/** Headers to merge into mutating browser fetches that send the session cookie. */
export function csrfHeaders(): Record<string, string> {
  const token = getCsrfToken();
  if (!token) return {};
  return { [CSRF_HEADER_NAME]: token };
}

export function isMutatingMethod(method: string | undefined): boolean {
  const m = (method || "GET").toUpperCase();
  return !SAFE_METHODS.has(m);
}

/**
 * Merge CSRF header into RequestInit for credentialed mutating calls.
 * Safe methods and missing tokens are no-ops.
 */
export function withCsrf(init: RequestInit = {}): RequestInit {
  if (!isMutatingMethod(init.method)) {
    return init;
  }
  const token = getCsrfToken();
  if (!token) return init;

  const headers = new Headers(init.headers);
  if (!headers.has(CSRF_HEADER_NAME)) {
    headers.set(CSRF_HEADER_NAME, token);
  }
  return { ...init, headers };
}
