# Docker Compose Configurations

This directory contains Docker Compose configurations for x-log.

## Files

- `docker-compose.yml` - Production-like setup (no hot-reload)
- `docker-compose.dev.yml` - Development setup with watch mode and hot-reload
- `.env.example` - Environment variables template (copy to `.env`)

## Development Mode

The `docker-compose.dev.yml` file is optimized for local development with:

- **Hot-reload**: Code changes are automatically reflected without restarting containers
- **Watch mode**: Uses Bun's `--watch` flag for automatic reloading
- **Volume mounts**: Source code is mounted for live editing
- **Docker Compose watch**: Uses Docker Compose v2.22+ watch feature for file syncing

### Prerequisites

- Docker Compose v2.22+ (for watch feature)
- Or use the basic dev mode without watch feature

### Usage

1. Copy environment file:
```bash
cp .env.example .env
# Edit .env with your settings
```

2. Start development environment:
```bash
# Basic dev mode (Bun watch)
docker-compose -f docker-compose.dev.yml up

# With Docker Compose watch (recommended)
docker-compose -f docker-compose.dev.yml watch
```

3. Access services:
- API: http://localhost:8080
- Web: http://localhost:3000
- Database: localhost:5432
- Redis: localhost:6379

### Features

- **API**: Automatically restarts on file changes using Bun's watch mode
- **Web**: Next.js dev server with hot-reload
- **Worker**: Automatically restarts on file changes using Bun's watch mode
- **Database & Redis**: Persistent volumes for data

### Notes

- `node_modules` are excluded from volume mounts for better performance
- Changes to `package.json` files trigger rebuilds
- Source code changes trigger automatic reloads
- Use `docker-compose -f docker-compose.dev.yml down` to stop services

