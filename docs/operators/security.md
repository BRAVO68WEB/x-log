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

The JWT is only a handle. Each login inserts a row in `auth_sessions`. Logout,
password change, password reset, and admin deactivation revoke those rows.
Tokens issued before this table existed stop working on the next request, so a
deploy of this change signs every current user out once.

**Sliding refresh:** when a cookie session has fewer than **2 days** remaining,
the API extends that same session row and re-signs its id (cookie path only;
Bearer mobile tokens are not slid).

`GET /api/users/me` includes:

- `auth_method`: `"cookie"` | `"bearer"`
- `session_expires_at`: ISO timestamp (when known)

Mobile and MCP clients use `Authorization: Bearer …` instead of cookies. A
Bearer request is exempt from CSRF only when the session cookie is absent. If
`xlog_session` is present, Origin and the double-submit token are required
even when a Bearer header is also sent.

## API errors

Error JSON always includes a human-readable `error` string. Optional fields:

| Field | Meaning |
|-------|---------|
| `code` | Machine code (`unauthorized`, `validation_error`, …) |
| `details` | Per-field Zod issues: `{ path, message }[]` |

Validation failures from request bodies return **400** with `code: validation_error`
and structured `details` when the thrown error is a Zod issue list.

## CSRF protection

Mutating `/api/*` requests that include the session cookie must pass:

1. **Origin / Referer** — hostname must be trusted (see below)
2. **Double-submit** — header `X-CSRF-Token` must equal cookie `xlog_csrf`

### What is skipped

- Safe methods: `GET`, `HEAD`, `OPTIONS`
- Requests **without** `xlog_session` (Bearer-only mobile and MCP clients,
  public login, register, invite accept, password reset, analytics collect
  with `credentials: "omit"`)

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

The client key is the socket address unless `TRUSTED_PROXY_HOPS` is greater
than 0. With hops set to 1 (one nginx or Cloudflare proxy), the API trusts
`CF-Connecting-IP` if present, otherwise the right-most `X-Forwarded-For`
value that proxy appended. The proxy must strip client-supplied copies of
those headers. `X-Real-IP` is not used. Blocked requests return **429** with
`Retry-After` and `X-RateLimit-*` headers when applicable.

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
| `TRUSTED_PROXY_HOPS` | `0` | Reverse proxies allowed to set the client IP |

<!-- prettier-ignore -->
> [!NOTE]
> The in-process limiter is fine for a single API instance. Multi-replica
> deploys should move buckets to Redis (or edge rate limits) so counts are
> shared across processes.

## Secrets at rest

Production refuses to boot without `DATA_ENCRYPTION_KEY` (32 bytes, standard
base64, `openssl rand -base64 32`). It encrypts ActivityPub private keys and
Nostr secrets. Do not derive it from `SESSION_SECRET`. Existing plaintext rows
are encrypted on migrate when the key is set. Decrypt still accepts leftover
plaintext so a dev database without the key keeps working.

Admin settings no longer return `smtp_url` or `ai_api_key`. The API returns
`has_smtp` and `has_ai_api_key`. A PATCH updates a secret only when the field
is a non-empty string. Send `clear_smtp` or `clear_ai_api_key` to remove one.
An empty string does not wipe the stored value.

`AI_ALLOW_PRIVATE_BASE=true` permits an AI base URL that resolves to a private
address. Outside production, private AI base URLs are allowed so a local model
can be used. Federation and link-unfurl fetches always refuse private and
metadata addresses.

## ActivityPub and MCP

- **Federation** inbox/outbox live outside cookie CSRF (signed HTTP traffic).
  Signed deliveries do not follow redirects. Inbound POST signatures must
  cover `(request-target)`, `host`, `date`, and `digest`.
- **MCP** uses Bearer keys at `/mcp` and `/mcp/jsonrpc`, not session cookies.
  `?api_key=` is ignored. `SESSION_SECRET` is not an MCP key. Per-user keys
  still authenticate when `MCP_API_KEY` is unset. Set `MCP_ENABLED=false` to
  turn the endpoints off.
- Public deploys must set `NODE_ENV=production`. Cookie `Secure` and the
  production CSRF missing-origin rejection follow that flag.

Set `NODE_ENV=production` on any instance that is reachable beyond localhost.

## Next steps

- [Federation operator guide](./federation.md)
- [Multi-user / registration](./multi-user.md)
- [Deploy](../../deploy/DEPLOY.md)
