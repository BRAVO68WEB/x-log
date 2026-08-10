# x-log Project Status

Living snapshot of what has shipped. Prefer this over scavenging old TODOs in
chat history. Roadmap phases 0–9 + 8c are done; follow-ups start at Phase 10.

## Shipped

### Infrastructure and packages

- [x] Monorepo (Turborepo), TypeScript, Docker Compose
- [x] `@xlog/config`, `@xlog/types`, `@xlog/snowflake`, `@xlog/db`, `@xlog/validation`
- [x] `@xlog/ap` (ActivityPub helpers, HTTP Signatures, tests)
- [x] `@xlog/markdown` (remark/rehype pipeline)
- [x] Database schema + migrations runner

### API (Hono)

- [x] OpenAPI + Scalar `/docs`
- [x] Session JWT cookies + Bearer (mobile) + role gates (admin/author)
- [x] Auth: login/logout, OIDC, password reset, open registration, email verify
- [x] Users, profiles, posts (CRUD, schedule, import, version history), feeds, search
- [x] Media upload (`MEDIA_DRIVER=local|s3`) + serving ETag/304 + orphan cleanup
- [x] Bookmarks, snippets, links, threads, reposts, AI helpers
- [x] Settings + admin features + multi-user invites
- [x] Analytics collect/status/summary (feature-flagged)
- [x] In-app notifications (follow/like) + optional email
- [x] MCP Streamable HTTP + legacy JSON-RPC + per-user MCP keys
- [x] Rate limit helpers (registration / invite accept / login)
- [x] **CSRF middleware** for cookie-session mutating `/api/*` (double-submit + Origin)
- [x] **Rate-limit middleware** global API + sensitive paths (B68-86)

### ActivityPub

- [x] Actor, inbox, outbox, followers, following
- [x] HTTP Signature verify + outbound signed GET (authorized-fetch)
- [x] Federation delivery worker + retries
- [x] Operator UX: delivery stats/retry + domain blocklist
- [x] Well-known: WebFinger, NodeInfo, host-meta

### Frontend (Next.js)

- [x] Homepage / landing, post detail, profiles, search, feeds
- [x] TipTap/Novel editor + drafts + schedule
- [x] Settings (general, users/invites, features, federation ops, analytics)
- [x] Onboarding wizard, login/register/invite/OIDC, notifications
- [x] Dark mode / themes, analytics beacon, author directory
- [x] CSRF headers on credentialed mutating client requests

### Product phases (roadmap B68-103)

| Phase | Status |
|-------|--------|
| 0 Primary author + solo/multi docs | Done |
| 1 Analytics dashboard UI | Done |
| 2 OTEL spans + PostHog server | Done |
| 3 Multi-user M1 invite + authz | Done |
| 4 Multi-user M2 registration modes | Done |
| 5 Multi-user M3 polish + MCP keys | Done |
| 6 Federation operator UX | Done |
| 7 S3/R2 media path | Done |
| 8a/8b Schedule + Markdown import | Done |
| 8c In-app notifications | Done |
| 9 Quality/docs (tests, operator guides, OpenAPI tags) | Done |
| 10 Hygiene (status + Linear cleanup) | Done |
| 11a CSRF | Done (PR #36) |
| 11b Broader rate-limit middleware | Done (PR #37) |
| 12 Author depth — post version history | Done (PR #38) |
| 13 Media ops cleanup | Done (PR #39) |
| 14 Quality / docs + smoke | Done (PR #40) |

### Documentation

- [x] Operator: federation, multi-user, analytics privacy, security, media, authoring
- [x] Deploy guide (`deploy/DEPLOY.md`)
- [x] API Scalar + OpenAPI tags
- [x] **Development guide** (`docs/development.md`, B68-102)
- [x] CONTRIBUTING.md linked to development guide

### Testing

- [x] Unit: HTTP Signatures (`packages/ap`)
- [x] Unit: analytics, invites, rate-limit, blocks, media-storage, CSRF, media-cleanup, post-versions (`apps/api`)
- [x] Smoke: `scripts/smoke-api.sh`, `scripts/smoke-mcp.sh`
- [x] Federation script: `scripts/test-federation.sh`
- [ ] Full browser E2E suite (still optional; B68-98)

## Still open (honest backlog)

Not “forgotten placeholders” — intentional follow-ups:

| Item | Notes |
|------|--------|
| ~~Global rate-limit middleware~~ | Done (B68-86) — Redis-backed multi-replica still optional |
| ~~Media cleanup / serving polish~~ | Phase 13 (B68-94 / B68-85) |
| ~~Development guide~~ | Phase 14 (B68-102) |
| ~~TipTap + editor image upload~~ | B68-83 / B68-90 — shipped |
| ~~Onboarding wizard~~ | B68-87 — shipped |
| ~~Post list pagination polish~~ | Keyset cursor + Load more UX (B68-88, PR #41) |
| ~~Responsive design polish~~ | B68-89 — mobile nav, editor stack, safe areas (PR #42) |
| ~~Federation delivery error UX~~ | B68-95 / Phase 6 — stats, last_error, retry |
| Deep integration / browser E2E | B68-97 / B68-98 (smoke + federation cover basics) |
| API validation / error / session nits | B68-91–93 (partial; CSRF + rate limits done) |

## Notes

- Default product posture is **solo-first**; multi-user is opt-in via invites /
  open registration caps (`MAX_LOCAL_AUTHORS`).
- Analytics, OTEL, and PostHog are **off by default**.
- Session CSRF: see `docs/operators/security.md`.
- Media: local disk by default; set `MEDIA_DRIVER=s3` + S3 env for R2/S3/MinIO.
