# Authoring (posts, schedule, versions)

How solo authors and multi-user instances use content features.

## Posts

Create and edit posts from **Editor** (`/editor`). Drafts live under
**My Posts** (`/drafts`). Visibility: public, unlisted, or private.

## Scheduled publish

1. Enable feature flag `scheduled_posts` (Settings → Features).
2. From My Posts, schedule a draft for a future time.
3. The worker publishes when `scheduled_at` is due.

## Markdown import

Authors can import Markdown files as drafts via the import API / UI
(`POST /api/posts/import`). Each imported file becomes a post with an
initial version snapshot.

## Version history

Every post keeps a content revision history (similar to code snippets):

| Action | Behavior |
|--------|----------|
| Create | Version `1` stored |
| Update title/body/summary/banner/tags | New version if content changed |
| Restore | Applies an old snapshot as a **new** version (history kept) |

Limits: last **50** versions per post are retained.

### API (author or admin)

- `GET /api/posts/:id/versions` — list
- `GET /api/posts/:id/versions/:n` — full snapshot
- `POST /api/posts/:id/versions/:n/restore` — restore as new current version

### UI

In the editor sidebar, expand **Version history** to list and restore
revisions. After restore, the editor reloads the restored content; save or
publish as usual.

## Next steps

- [Multi-user](./multi-user.md)
- [Security (CSRF, rate limits)](./security.md)
