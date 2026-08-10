# Contributing to x-log

Thanks for helping improve x-log.

## Full guide

For setup, monorepo layout, migrations, CSRF, tests, and smoke scripts, read:

**[docs/development.md](./docs/development.md)**

## Quick start

```bash
bun install
cp .env.example .env   # set SESSION_SECRET, DATABASE_URL, REDIS_URL, OIDC_* placeholders
make setup && make dev # or: bun run migrate && bun run dev
```

- Web: http://localhost:3000  
- API: http://localhost:8080/docs  

Create a local admin: `cd apps/api && bun run init-local-user`

## Before you open a PR

1. Branch from **`dev`**.
2. Keep the change focused (one concern).
3. Run:

```bash
bun run type-check
bun run test
```

4. Optional smoke (API running):

```bash
./scripts/smoke-api.sh
```

5. Target the PR at **`dev`**, with a short summary and test plan.

## Code style

- TypeScript; follow patterns in neighboring files.
- Meaningful commit messages (what + why).
- No secrets in the tree.

## License

By contributing, you agree your contributions are licensed under the AGPL-3.0
license (see `LICENSE`).
