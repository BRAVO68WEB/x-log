# x-log

A federated blog platform built on ActivityPub.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/BRAVO68WEB/x-log&root-directory=apps/web&env=DATABASE_URL,SESSION_SECRET,INSTANCE_DOMAIN,OIDC_CLIENT_ID,OIDC_CLIENT_SECRET,OIDC_REDIRECT_URI,OIDC_DISCOVERY_URL&envDescription=Required%20configuration&envLink=https://github.com/BRAVO68WEB/x-log/blob/main/deploy/.env.production.example)

**Other options:** [Docker Compose](deploy/DEPLOY.md#option-2-docker-compose-self-hosted) · [Docker](deploy/DEPLOY.md#option-3-docker-single-container) · [Full deploy guide](deploy/DEPLOY.md)

## Overview

x-log is an open-source, Bun + TypeScript powered blog platform that federates with the Fediverse using ActivityPub. Readers on Mastodon, Elk, Soapbox, and compatible clients can search, read, like, and follow x-log profiles and posts directly from their clients.

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **API**: Hono
- **Validation**: Zod + zod-to-openapi
- **Database**: PostgreSQL + Kysely
- **Frontend**: Next.js (App Router) + TailwindCSS
- **Monorepo**: Turborepo
- **Queue**: Redis + Worker (Bun)
- **Deployment**: Docker Compose

## Getting Started

### Prerequisites

- Bun >= 1.0.0
- Docker and Docker Compose
- PostgreSQL 16
- Redis 7

### Development

1. Install dependencies:

```bash
bun install
```

2. Set up environment variables:

```bash
# For local development (outside Docker)
cp .env.example .env
# Edit .env with your settings

# OR for Docker Compose
cp infra/compose/.env.example infra/compose/.env
# Edit infra/compose/.env with your settings
```

3. Set up environment file:

```bash
make setup
# Or manually:
cp infra/compose/.env.example infra/compose/.env
# Edit infra/compose/.env with your settings
```

4. Start services with Docker Compose:

For development with hot-reload/watch mode (recommended):

```bash
make dev
# Or with Docker Compose watch (requires Docker Compose v2.22+):
make dev-watch
```

For production-like setup:

```bash
make up
```

5. Run migrations:

```bash
make migrate
# Or manually:
cd apps/api && bun run migrate
```

### Available Make Commands

- `make dev` - Start development environment with Bun watch mode
- `make dev-watch` - Start development environment with Docker Compose watch
- `make dev-stop` - Stop development environment
- `make migrate` - Run database migrations
- `make logs` - View logs from all services
- `make clean` - Remove containers, volumes, and images
- `make help` - Show all available commands

### Mobile App

The repo now includes an Expo mobile app in `apps/mobile`.

Useful commands:

- `bun run mobile` - Start the Expo development server
- `bun run mobile:ios` - Run the mobile app on iOS
- `bun run mobile:android` - Run the mobile app on Android

Environment variables:

- `EXPO_PUBLIC_API_BASE_URL` - Direct backend API URL for native clients, for example `http://localhost:8080/api`
- `EXPO_PUBLIC_EAS_PROJECT_ID` - EAS project ID used for release builds

### Services

When running `make dev`, the following services will be available:

- API server on http://localhost:8080 (internal, not exposed in production)
- Web server on http://localhost:3000 (public-facing)
- Worker service (background jobs)
- PostgreSQL on localhost:5432
- Redis on localhost:6379

### API Architecture

All API requests are proxied through Next.js SSR routes. In production, only the Next.js server is exposed to the internet, and it internally communicates with the backend API server.

**Environment Variables:**

- `BACKEND_API_URL` - Internal URL to the backend API server (defaults to `NEXT_PUBLIC_API_URL` or `http://localhost:8080`)
- `NEXT_PUBLIC_API_URL` - Fallback for backend API URL (used in development)

**API Flow:**

1. Frontend makes requests to `/api/*` (Next.js routes)
2. Next.js API routes proxy requests to the backend API server
3. Backend API server processes requests and returns responses
4. Next.js forwards responses back to the frontend

This architecture ensures:

- Backend API is not directly exposed to the internet
- Session cookies are properly forwarded
- CORS issues are avoided
- Single entry point for all API requests

### Project Structure

```
x-log/
├── apps/
│   ├── api/          # Hono API server
│   ├── mobile/       # Expo + React Native mobile app
│   ├── web/          # Next.js frontend
│   └── worker/       # Background job worker
├── packages/
│   ├── db/           # Kysely database client and schema
│   ├── validation/   # Zod schemas
│   ├── ap/           # ActivityPub helpers
│   ├── snowflake/    # Snowflake ID generator
│   ├── config/       # Shared configuration
│   ├── ui/           # Shared UI components
│   └── types/        # Shared TypeScript types
└── infra/
    └── compose/       # Docker Compose configuration
```

## Analytics & observability (opt-in)

### First-party page views

Off by default. Enable the **`analytics`** feature flag (admin UI or `FEATURE_ANALYTICS=true`).

- Beacon: post pages and profiles (`/u/[username]`) call `POST /api/analytics/collect` when enabled
- Stores path, post_id, referrer, UA, **hashed IP** (raw IP only if `ANALYTICS_STORE_RAW_IP=true`)
- Respects DNT / Sec-GPC when `ANALYTICS_RESPECT_DNT=true` (default)
- Summary: `GET /api/analytics/summary` (auth; admin = all posts, author = own) includes post titles + privacy meta
- Dashboard: **`/analytics`** (any signed-in user) and **Settings → Analytics** (admin)
- Retention: worker purges rows older than `ANALYTICS_RETENTION_DAYS` (default 90)

### OpenTelemetry

```bash
# API
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://your-collector:4318
OTEL_SERVICE_NAME=x-log-api

# Worker (same collector, different service name)
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://your-collector:4318
OTEL_SERVICE_NAME=x-log-worker
```

Processes dynamically load OTEL only when enabled. Custom spans include `federation.deliver`, `ap.verify_signature`, `ap.key_fetch`, `mcp.tool_call`, `analytics.collect`. See `deploy/DEPLOY.md` for a sample Jaeger collector.

### PostHog

Use **your** PostHog project (not x-log SaaS telemetry):

```bash
# Web client
NEXT_PUBLIC_POSTHOG_ENABLED=true
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Optional server events (API + worker)
POSTHOG_SERVER_ENABLED=true
POSTHOG_KEY=phc_...
POSTHOG_HOST=https://us.i.posthog.com
```

Server events: `post_published`, `follow_received`, `mcp_tool_called` (name only), `federation_delivery_failed`. Distinct id = primary author or `instance:{domain}`. No PostHog network calls when disabled; first-party visitor IPs are never forwarded.

## Instance modes (solo vs multi)

x-log is **solo-first**: one domain, one **primary author** (site owner).

| Mode | When | Behavior |
|------|------|----------|
| **solo** | ≤1 local user (default) | Landing can use primary profile; MCP key acts as primary; registrations closed |
| **multi** | 2+ local users | Multiple authors, each a separate ActivityPub actor; still one operator/admin |

### Primary author

Stored as `instance_settings.primary_user_id` (backfilled to oldest admin on migrate).

Used for:
- Profile-as-landing (`use_profile_as_landing`)
- Instance “follow remote” as the site account
- MCP write tools when `MCP_ACTOR_USERNAME` is unset
- Public `/api/public/instance` → `primary_profile`
- NodeInfo metadata contact account

Set via **Settings → Federation → Primary author** (admin UI), or
`PATCH /api/settings` with `{ "primary_user_id": "<uuid>" }`.

### Roles (minimal)

| Capability | admin | author |
|------------|-------|--------|
| Publish as self | ✓ | ✓ |
| Instance settings / primary user | ✓ | |
| Invite users (Phase 3+) | ✓ | |

**Not a social network:** no local timeline of strangers; multi-user is for small teams / invite-only blogs.

### Invite authors (multi-user M1)

1. Admin → **Settings → Users → Create invite**
2. Share the one-time link (`/invite/<token>`, 7-day expiry)
3. Invitee chooses username + password → becomes **author** with ActivityPub keys
4. Cap: `MAX_LOCAL_AUTHORS` (default **10** active admin+author accounts)
5. Soft-deactivate users from the same Users tab (blocks login)

Authors cannot change instance domain / federation / primary author (settings remain admin-only). Post CRUD is scoped to `author_id` (admins may edit any).

## MCP server

x-log exposes a remote **Model Context Protocol** server so agents (Cursor, Claude, etc.) can read public content and create/publish posts as a configured local author.

### Enable

```bash
# Generate a dedicated key (do not reuse SESSION_SECRET in production)
openssl rand -hex 32
```

Set in `.env`:

```bash
MCP_API_KEY=<your-key>
# Optional: username write tools act as (default: primary admin)
MCP_ACTOR_USERNAME=admin
```

Restart the API. `GET /health` reports `mcp.enabled` and paths.

### Endpoints

| URL | Protocol |
|-----|----------|
| `https://{INSTANCE_DOMAIN}/api/mcp` | **Streamable HTTP** (via Next proxy → API `/mcp`) — preferred for Cursor/Claude |
| `https://{INSTANCE_DOMAIN}/mcp` | Streamable HTTP direct to API (if API is public) |
| `https://{INSTANCE_DOMAIN}/api/mcp/jsonrpc` | Legacy JSON-RPC 2.0 POST |
| `https://{INSTANCE_DOMAIN}/mcp/jsonrpc` | Legacy JSON-RPC direct |

Auth: `Authorization: Bearer <MCP_API_KEY>`

### Cursor / Claude remote config example

```json
{
  "mcpServers": {
    "x-log": {
      "url": "https://YOUR_DOMAIN/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_API_KEY"
      }
    }
  }
}
```

### Tools

**Read:** `get_posts`, `get_post`, `get_profile`, `search`, `get_instance_info`  
**Write (as MCP actor):** `create_post`, `update_post`, `publish_post`, `delete_post`

Write tools use `MCP_ACTOR_USERNAME` (or the primary admin). The Bearer key is equivalent to that author for posting — protect it.

### Legacy JSON-RPC

```bash
curl -s https://YOUR_DOMAIN/api/mcp/jsonrpc \
  -H "Authorization: Bearer $MCP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## License

AGPL-3.0 (to be confirmed)

## Mobile Release Workflow

Tagging a commit with `mobile-v<version>` triggers `.github/workflows/mobile-release.yml`.

Example:

```bash
git tag mobile-v1.0.0
git push origin mobile-v1.0.0
```

Required GitHub secrets:

- `EXPO_TOKEN`
- `EXPO_PUBLIC_EAS_PROJECT_ID`
