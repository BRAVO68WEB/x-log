# Security (sessions, CSRF, rate limits)

This guide covers how x-log protects cookie-based dashboard sessions and what
operators need to know for production.

## Session cookies

Dashboard auth uses an HTTP-only JWT cookie:

| Cookie | HTTP-only | Purpose |
|--------|-----------|---------|
| `xlog_session` | Yes | Session JWT (7 days) |
| `xlog_csrf` | No | Double-submit CSRF token (readable by the SPA) |

Both use `SameSite=Strict`, `Path=/`, and `Secure` in production.

Mobile and MCP clients use `Authorization: Bearer …` instead of cookies. Those
requests are not subject to CSRF checks.

## CSRF protection

Mutating `/api/*` requests that include the session cookie must pass:

1. **Origin / Referer** — hostname must be trusted (see below)
2. **Double-submit** — header `X-CSRF-Token` must equal cookie `xlog_csrf`

### What is skipped

- Safe methods: `GET`, `HEAD`, `OPTIONS`
- Requests with `Authorization: Bearer …` (API keys, mobile, MCP)
- Requests **without** `xlog_session` (public login, register, invite accept,
  password reset, analytics collect with `credentials: "omit"`)

### Trusted hosts

The API builds a trust set from:

- `INSTANCE_DOMAIN`
- Host of `OIDC_REDIRECT_URI` (usually the public web origin)
- Host of `NEXT_PUBLIC_API_URL`
- In non-production: `localhost`, `127.0.0.1`, `0.0.0.0`

If the web app is served on a different host than `INSTANCE_DOMAIN` (for
example a separate frontend CDN), ensure `OIDC_REDIRECT_URI` or the public site
hostname is covered by those values so Origin checks succeed.

### Web client

The SPA reads `xlog_csrf` and sends `X-CSRF-Token` via `apps/web/src/lib/csrf.ts`
(`withCsrf` / `csrfHeaders`). The Next.js `/api/[...path]` proxy forwards
cookies and headers to the Hono API.

### Failures

Failed CSRF checks return **403** with a short error message:

- `CSRF validation failed: untrusted origin`
- `CSRF validation failed: token mismatch`

After deploy, the first authenticated `GET` (for example `/api/users/me`)
backfills a missing CSRF cookie for existing sessions.

## Rate limiting

x-log uses an **in-process** sliding-window limiter
(`apps/api/src/lib/rate-limit.ts`) plus global middleware
(`apps/api/src/middleware/rate-limit.ts`).

Limits are per client IP (from `CF-Connecting-IP`, `X-Forwarded-For`, or
`X-Real-IP`). Blocked requests return **429** with `Retry-After` and
`X-RateLimit-*` headers when applicable.

### Middleware (always on unless disabled)

| Scope | Default | Notes |
|-------|---------|--------|
| Global `/api/*` | 600 / minute | Override with `RATE_LIMIT_API_MAX`, `RATE_LIMIT_API_WINDOW_MS` |
| Login (web + mobile) | 20 / 15 minutes | Brute-force guard |
| Forgot / reset password | 10–20 / hour | Plus per-user DB limit on forgot |
| Analytics collect | 120 / minute | Public beacon |
| Media upload | 60 / minute | |
| MCP | 180 / minute | `RATE_LIMIT_MCP_MAX` |
| ActivityPub inbox POST | 240 / minute | `RATE_LIMIT_INBOX_MAX` |

Skipped paths: `/health`, `/docs`, OpenAPI JSON, well-known discovery GETs,
and public actor GETs (so probes and Fediverse discovery stay cheap).

### Route-level (extra)

| Endpoint | Limit |
|----------|--------|
| Public registration | 5 / hour |
| Invite accept | 10 / hour |
| Email verify | 20 / hour |
| Login | 20 / 15 minutes (route + middleware) |

### Configuration

| Env | Default | Purpose |
|-----|---------|---------|
| `RATE_LIMIT_ENABLED` | on (unset) | Set to `false` to disable middleware |
| `RATE_LIMIT_API_MAX` | `600` | Global API requests per window |
| `RATE_LIMIT_API_WINDOW_MS` | `60000` | Global window (ms) |
| `RATE_LIMIT_MCP_MAX` | `180` | MCP requests per minute |
| `RATE_LIMIT_INBOX_MAX` | `240` | Inbox POSTs per minute |

<!-- prettier-ignore -->
> [!NOTE]
> The in-process limiter is fine for a single API instance. Multi-replica
> deploys should move buckets to Redis (or edge rate limits) so counts are
> shared across processes.

## ActivityPub and MCP

- **Federation** inbox/outbox live outside cookie CSRF (signed HTTP traffic).
- **MCP** uses Bearer keys at `/mcp` and `/mcp/jsonrpc`, not session cookies.

## Next steps

- [Federation operator guide](./federation.md)
- [Multi-user / registration](./multi-user.md)
- [Deploy](../../deploy/DEPLOY.md)
