# Development guide

How to work on x-log as a contributor. For production ops, use
[docs/operators/](./operators/). For deploy, see [deploy/DEPLOY.md](../deploy/DEPLOY.md).

## Prerequisites

- **Bun** >= 1.0
- **Docker** + Docker Compose (Postgres, Redis, optional full stack)
- **PostgreSQL 16** and **Redis 7** if you run services outside Compose
- **Git** and a GitHub account for PRs

## Monorepo layout

```
apps/
  api/      # Hono API (port 8080 by default)
  web/      # Next.js App Router (port 3000)
  worker/   # Federation delivery + scheduled posts
  mobile/   # Expo client (optional)
packages/
  ap/       # ActivityPub + HTTP Signatures
  config/   # Zod-validated env
  db/       # Kysely schema + migrations
  markdown/ # Render pipeline
  validation/
  snowflake/
  types/
docs/
  operators/   # Production / instance operator guides
  development.md  # This file
infra/compose/ # Docker Compose for local and prod-like stacks
scripts/       # Smoke and federation tests
```

Root scripts (see root `package.json`):

| Command | Purpose |
|---------|---------|
| `bun install` | Install workspaces |
| `bun run dev` | Turbo dev (API, web, worker via dotenv) |
| `bun run test` | Unit tests: `packages/ap`, `packages/db`, `apps/api` |
| `bun run type-check` | Turbo TypeScript check |
| `bun run migrate` | Run DB migrations |
| `bun run format` | Prettier |

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/BRAVO68WEB/x-log.git
cd x-log
bun install
```

### 2. Environment

```bash
cp .env.example .env
# Set SESSION_SECRET (32+ chars), DATABASE_URL, REDIS_URL, INSTANCE_DOMAIN
# OIDC_* vars are required by config even for local password login
```

For Docker Compose:

```bash
make setup
# edits infra/compose/.env
```

### 3. Start dependencies

**Option A — Makefile (recommended):**

```bash
make setup
make dev          # docker-compose.dev.yml with Bun watch
# or
make dev-watch    # Compose watch (Docker Compose v2.22+)
make migrate
```

**Option B — local Bun + Docker only for DB/Redis:**

```bash
# Start Postgres + Redis (your preferred method)
cp .env.example .env
# DATABASE_URL=postgres://... REDIS_URL=redis://localhost:6379
bun run migrate
bun run dev
```

### 4. First admin user

```bash
cd apps/api && bun run init-local-user
# Follow prompts / env for username and password
```

### 5. URLs

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:8080 |
| API docs (Scalar) | http://localhost:8080/docs |
| OpenAPI JSON | http://localhost:8080/api/openapi.json |
| Health | http://localhost:8080/health |

The web app proxies `/api/*` to the Hono API (`BACKEND_API_URL`).

## Day-to-day workflow

1. Create a branch from latest `dev` (not `main` unless releasing).
2. Make a **small, focused** change (one concern per PR).
3. Run checks:

```bash
bun run type-check
bun run test
# Optional, API running:
./scripts/smoke-api.sh
./scripts/smoke-mcp.sh   # needs MCP_API_KEY
```

4. Open a PR targeting **`dev`** with a short summary and test plan.

### Database migrations

- Add files under `packages/db/src/migrations/` (`NNN_name.ts` with `name`, `up`, `down`).
- Update `packages/db/src/schema.ts` types in the same PR.
- Run: `cd apps/api && bun run migrate` (or `make migrate` under Compose).
- Prefer additive migrations; avoid destructive drops without a plan.

### Feature flags

Instance flags live in `feature_flags` (admin Settings → Features). Env override:
`FEATURE_<KEY>=true|false` (see `apps/api/src/lib/features.ts`).

### CSRF and cookies

Browser session auth uses `xlog_session` (HTTP-only) + `xlog_csrf` (readable).
Mutating cookie requests must send `X-CSRF-Token`. See
[operators/security.md](./operators/security.md).

Bearer tokens (mobile, MCP) skip CSRF.

### Rate limits

In-process limits apply by default. Disable for load tests with
`RATE_LIMIT_ENABLED=false`. Details in [operators/security.md](./operators/security.md).

## Testing

### Unit tests

```bash
# All packages wired into root script
bun run test

# Single package
cd apps/api && bun test src
cd packages/ap && bun test
cd packages/db && bun test
```

Tests use `bun:test`. Prefer pure helpers and avoid live DB unless the package
already does so.

### Integration tests (in-process)

Hono app factory `createApp()` in `apps/api/src/app.ts` is tested without
binding a port:

```bash
bun run test:integration
# or
cd apps/api && bun test src/app.integration.test.ts
```

These use `app.request()` for health, auth 401, CSRF boundaries, and (when
Postgres is reachable) public list routes.

### Smoke / E2E scripts

| Script | Needs | What it checks |
|--------|--------|----------------|
| `scripts/smoke-api.sh` | Running API | health, OpenAPI, docs, posts list, `/me` 401, nodeinfo |
| `scripts/smoke-e2e-auth.sh` | API + `E2E_USERNAME` / `E2E_PASSWORD` | login, CSRF, `/me`, logout |
| `scripts/smoke-mcp.sh` | API + `MCP_API_KEY` | MCP `tools/list` |
| `scripts/test-federation.sh` | Public instance | WebFinger, actor, nodeinfo, etc. |

Example:

```bash
# API up on 8080
./scripts/smoke-api.sh
make smoke

E2E_USERNAME=admin E2E_PASSWORD=secret ./scripts/smoke-e2e-auth.sh
# or
make smoke-auth
```

Browser automation E2E is not required for merge; smoke + federation cover the
critical remote paths.

## Package notes

| Package | When you touch it |
|---------|-------------------|
| `@xlog/db` | Schema, migrations, instance settings |
| `@xlog/ap` | Signatures, ActivityPub objects |
| `@xlog/config` | New env vars (Zod schema) |
| `@xlog/validation` | Shared request/response Zod schemas |
| `apps/api` | Routes, middleware, services |
| `apps/web` | UI; use `apiRequest` / `withCsrf` for mutating calls |
| `apps/worker` | Delivery queue, scheduled publish |

## Common pitfalls

- **OIDC env required** — `@xlog/config` validates OIDC vars at startup; set
  placeholders in `.env` even if you only use password login.
- **Proxy Origin** — CSRF trusts `INSTANCE_DOMAIN` and OIDC redirect host;
  local web is usually `localhost:3000` (dev hosts are allowed).
- **Media** — local files land in `uploads/`; S3 needs `MEDIA_DRIVER=s3` and
  bucket env vars ([operators/media.md](./operators/media.md)).
- **Migrations not applied** — API runs migrate on boot in some setups; still
  run `make migrate` after pulling migration PRs.

## Code style

- TypeScript throughout; match existing patterns in the file you edit.
- Prefer small pure functions with unit tests for non-trivial logic.
- Do not commit secrets; use `.env` (gitignored).
- Format with Prettier: `bun run format`.

## License

Contributions are licensed under **AGPL-3.0** (see repository `LICENSE`).

## Next steps

- [Operator guides](./operators/README.md)
- [Deploy](../deploy/DEPLOY.md)
- [Contributing](../CONTRIBUTING.md) — short checklist
- [Project status](../PROJECT_STATUS.md) — what is already shipped
