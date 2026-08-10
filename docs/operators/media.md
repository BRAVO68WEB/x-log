# Media storage and cleanup

How x-log stores uploads, serves them efficiently, and purges orphans.

## Drivers

| `MEDIA_DRIVER` | Behavior |
|----------------|----------|
| `local` (default) | Files under `uploads/`; served by the API |
| `s3` | S3-compatible (R2/S3/MinIO); see [Deploy](../../deploy/DEPLOY.md) |

When `MEDIA_S3_PUBLIC_URL` is set, GET `/api/media/:filename` **redirects** to
the CDN/object URL instead of proxying bytes.

## Serving (B68-85)

Local (and private S3 proxy) responses include:

- `Content-Type`, `Content-Length`
- `Cache-Control: public, max-age=31536000, immutable`
- Weak `ETag` + `If-None-Match` → **304**
- `X-Content-Type-Options: nosniff`
- `HEAD /api/media/:filename` for metadata without body

## Library management (B68-94)

Each upload creates a `media` row. Linking a file to a post sets `post_id`
(editor/banner pipeline). Rows with `post_id` null are **orphans** (unlinked).

### API

| Endpoint | Who | Purpose |
|----------|-----|---------|
| `GET /api/media/stats` | Author (own) / admin (all) | Counts and bytes |
| `GET /api/media/orphans` | Author / admin | List unlinked rows; `?older_than_days=&include_untracked=` |
| `POST /api/media/cleanup` | Author / admin | Purge orphans; JSON body below |

Cleanup body (defaults are safe):

```json
{
  "dry_run": true,
  "older_than_days": 7,
  "include_untracked": false,
  "limit": 100
}
```

- **dry_run** — list what would be deleted without removing files (default `true`)
- **older_than_days** — only orphans older than this many days
- **include_untracked** — admin only; local files on disk with no DB row
- Authors only delete **their** orphan rows; admins can clean all

### UI

**Assets** (`/assets`): storage stats cards, orphan badges, and
**Clean orphans (7d+)** (preview via dry-run, then confirm).

## Operational tips

1. Prefer `MEDIA_DRIVER=s3` + public URL in production so the API is not a
   byte proxy.
2. Run dry-run cleanup before real deletes.
3. Back up `uploads/` (local) or the bucket (S3) with the database.

## Next steps

- [Deploy guide](../../deploy/DEPLOY.md) — env vars for S3/R2
- [Security](./security.md) — rate limits on media upload
