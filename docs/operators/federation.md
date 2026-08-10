# Federation operator guide

x-log is an ActivityPub blog: each local author is a separate actor (`/ap/users/:username`).

## Checklist

1. **Settings → Federation**: enable federation (and following if desired)
2. Set **primary author** (site owner for landing / instance follows)
3. Point DNS + HTTPS at the instance; WebFinger requires correct `instance_domain`
4. Outbound delivery needs **Redis** + the **worker** process

## Debugging deliveries

**Settings → Federation → Operator tools**

| Control | Meaning |
|---------|---------|
| 24h stats | Counts of `sent` / `failed` / `pending` deliveries |
| Recent failures | Last errors + remote host |
| Retry / Retry all | Re-queue to Redis `federation:deliveries` |

Worker logs delivery errors; OTEL span `federation.deliver` appears when OTEL is enabled.

## Domain blocklist

Block abusive or spammy remotes:

- Inbox activities from blocked actor domains → **403**
- Outbound fan-out **skips** inboxes on blocked hosts

Manage under the same Operator tools panel, or:

```http
POST /api/admin/federation/blocks  { "domain": "spam.example", "reason": "…" }
DELETE /api/admin/federation/blocks/:id
```

## Compatibility smoke test

```bash
./scripts/test-federation.sh --username YOUR_USER --domain your.domain
```

Checks WebFinger, actor document, outbox, NodeInfo-style public endpoints.

## Related env

| Variable | Role |
|----------|------|
| `FEDERATION_ENABLED` | Default federation on/off (instance setting can differ) |
| `REDIS_URL` | Delivery queue |
| `OTEL_*` | Traces including AP verify / deliver |
