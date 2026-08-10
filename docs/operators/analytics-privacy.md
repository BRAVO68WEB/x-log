# Analytics privacy

First-party page views are **opt-in** and separate from PostHog/OTEL.

## Enable

1. Settings → Features → **Analytics**, or `FEATURE_ANALYTICS=true`
2. View dashboard at `/analytics` (signed-in) or Settings → Analytics (admin)

## What is stored

| Field | Notes |
|-------|--------|
| `path` | Request path |
| `post_id` / `author_id` | When beacon sends a post id |
| `referrer` / `referrer_host` | Parsed host for top referrers |
| `user_agent` | Truncated |
| `ip_hash` | HMAC of client IP (salt = `ANALYTICS_SALT` or `SESSION_SECRET`) |
| `ip_raw` | **Only if** `ANALYTICS_STORE_RAW_IP=true` (default off) |
| `session_id` | Browser-generated id for dedupe, not a login session |

## Respect for visitors

| Env | Default | Behavior |
|-----|---------|----------|
| `ANALYTICS_RESPECT_DNT` | `true` | Skip collect when DNT or Sec-GPC |
| Bots | — | Empty or bot-like UAs are dropped |
| PostHog | off | Never receives first-party visitor IPs |

## Retention

Worker purges `page_views` older than `ANALYTICS_RETENTION_DAYS` (default **90**).

## Scope

- **Admin** summary: all posts
- **Author** summary: own posts only (`author_id`)

## Related

- PostHog / OTEL are optional product/ops telemetry; see `deploy/DEPLOY.md`
- Dashboard privacy panel shows current env settings read-only
