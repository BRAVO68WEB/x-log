# Multi-user operations

x-log is **solo-first**. Multi-author is invite-first; open registration is opt-in.

## Modes

| Mode | How to enable |
|------|----------------|
| Solo | One admin after onboarding (default) |
| Invite-only multi | Settings → **Users** → Create invite |
| Open registration | Settings → Users → **Open public registration**, or `OPEN_REGISTRATIONS=true` |

Cap active admin+author accounts with `MAX_LOCAL_AUTHORS` (default **10**).

## Roles

| Role | Can |
|------|-----|
| **admin** | Instance settings, invites, features, federation ops, any post |
| **author** | Own posts/media, schedule (flag), import, own MCP keys, own analytics |
| **reader** | Reserved; not used for signup |

Signup and invite accept always create **author** (never admin).

## Invites

1. Admin creates invite → one-time link `/invite/<token>` (7 days)
2. Invitee chooses username + password → AP keypair created
3. Soft-deactivate: Settings → Users → Deactivate (blocks login)

Reserved usernames (`admin`, `api`, `settings`, …) are rejected.

## MCP keys

| Key | Acts as |
|-----|---------|
| Env `MCP_API_KEY` | Primary author (or `MCP_ACTOR_USERNAME`) |
| Profile → **MCP API keys** (`xlog_mcp_…`) | That user only |

## Registration rate limits

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/register` | 5 / hour / IP |
| Invite accept | 10 / hour / IP |

## Migrations of interest

- `027_user_invites` — invites + `is_active`
- `028_email_verification` — optional verify on register
- `029_mcp_api_keys` — per-user MCP keys
