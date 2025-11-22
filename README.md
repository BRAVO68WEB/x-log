# x-log

A federated blog platform built on ActivityPub.

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

### Services

When running `make dev`, the following services will be available:
- API server on http://localhost:8080
- Web server on http://localhost:3000
- Worker service (background jobs)
- PostgreSQL on localhost:5432
- Redis on localhost:6379

### Project Structure

```
x-log/
├── apps/
│   ├── api/          # Hono API server
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

## License

AGPL-3.0 (to be confirmed)

