.PHONY: help dev dev-watch dev-stop build up down logs migrate clean install test smoke smoke-auth

# Default target
help:
	@echo "x-log Makefile Commands:"
	@echo ""
	@echo "  make dev          - Start development environment with watch mode"
	@echo "  make dev-watch    - Start development environment with Docker Compose watch"
	@echo "  make dev-stop     - Stop development environment"
	@echo "  make build        - Build all services"
	@echo "  make up           - Start production environment"
	@echo "  make down         - Stop all services"
	@echo "  make logs         - View logs from all services"
	@echo "  make migrate      - Run database migrations"
	@echo "  make clean        - Remove containers, volumes, and images"
	@echo "  make install      - Install dependencies"
	@echo "  make test         - Run unit tests (bun)"
	@echo "  make smoke        - API smoke script (API must be up)"
	@echo "  make smoke-auth   - Optional auth E2E (E2E_USERNAME/PASSWORD)"
	@echo ""

# Development with watch mode (Bun --watch)
dev:
	@echo "Starting development environment with Bun watch mode..."
	docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env up

# Development with Docker Compose watch (requires Docker Compose v2.22+)
dev-watch:
	@echo "Starting development environment with Docker Compose watch..."
	docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env watch

# Stop development environment
dev-stop:
	@echo "Stopping development environment..."
	docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env down

# Build all services
build:
	@echo "Building services..."
	docker compose -f infra/compose/docker-compose.yml --env-file infra/compose/.env build

# Start production environment
up:
	@echo "Starting production environment..."
	docker compose -f infra/compose/docker-compose.yml --env-file infra/compose/.env up -d

# Stop all services
down:
	@echo "Stopping all services..."
	docker compose -f infra/compose/docker-compose.yml --env-file infra/compose/.env down

# View logs
logs:
	docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env logs -f

# Run database migrations
migrate:
	@echo "Running database migrations..."
	docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env exec api bun run migrate

# Clean up containers, volumes, and images
clean:
	@echo "Cleaning up Docker resources..."
	docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env down -v --remove-orphans
	docker compose -f infra/compose/docker-compose.yml --env-file infra/compose/.env down -v --remove-orphans

# Install dependencies locally
install:
	@echo "Installing dependencies..."
	bun install

# Unit tests
test:
	@echo "Running unit tests..."
	bun run test

# Lightweight API smoke (requires API on API_URL or localhost:8080)
smoke:
	@echo "Running API smoke checks..."
	bash ./scripts/smoke-api.sh

# Optional authenticated E2E (E2E_USERNAME + E2E_PASSWORD)
smoke-auth:
	@echo "Running auth E2E smoke..."
	bash ./scripts/smoke-e2e-auth.sh

# Setup: create .env file if it doesn't exist
setup:
	@if [ ! -f infra/compose/.env ]; then \
		echo "Creating .env file from .env.example..."; \
		cp infra/compose/.env.example infra/compose/.env; \
		echo "Please edit infra/compose/.env with your settings"; \
	else \
		echo ".env file already exists"; \
	fi

# Restart a specific service
restart-%:
	docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env restart $(subst restart-,,$@)

# Execute command in a service
exec-api:
	docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env exec api sh

exec-web:
	docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env exec web sh

exec-worker:
	docker compose -f infra/compose/docker-compose.dev.yml --env-file infra/compose/.env exec worker sh

