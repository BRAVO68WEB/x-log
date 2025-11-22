# Contributing to x-log

Thank you for your interest in contributing to x-log!

## Development Setup

1. Clone the repository
2. Install dependencies: `bun install`
3. Copy `.env.example` to `.env` and configure
4. Start services: `docker-compose -f infra/compose/docker-compose.yml up -d`
5. Run migrations: `cd apps/api && bun run migrate`
6. Start development: `bun run dev`

## Code Style

- Use TypeScript
- Follow existing code patterns
- Run `bun run lint` before committing
- Write meaningful commit messages

## Pull Requests

1. Create a feature branch
2. Make your changes
3. Ensure tests pass (when tests are added)
4. Submit a pull request with a clear description

## License

By contributing, you agree that your contributions will be licensed under the AGPL-3.0 license.

