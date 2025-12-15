# x-log Project Status

## ✅ Completed

### Infrastructure
- [x] Monorepo structure with Turborepo
- [x] TypeScript configuration
- [x] Docker Compose setup
- [x] Package structure

### Packages
- [x] `@xlog/config` - Environment configuration with Zod validation
- [x] `@xlog/types` - Shared TypeScript types
- [x] `@xlog/snowflake` - Snowflake ID generator
- [x] `@xlog/db` - Kysely database client and schema
- [x] `@xlog/validation` - Zod schemas for API validation
- [x] `@xlog/ap` - ActivityPub helpers and formatters
- [x] `@xlog/markdown` - Markdown rendering with rehype/remark pipeline
- [x] `@xlog/ui` - Shared UI components (placeholder)

### Database
- [x] Complete schema definition
- [x] Initial migration (001_initial)
- [x] Migration runner

### API (Hono)
- [x] OpenAPI integration
- [x] Session management and authentication
- [x] Auth routes (login/logout) with JWT sessions
- [x] Onboarding routes
- [x] User routes with auth
- [x] Profile routes with auth
- [x] Post routes (CRUD) with auth and markdown rendering
- [x] Feed routes (RSS/Atom) with markdown rendering
- [x] Search routes with full-text search
- [x] Media upload routes
- [x] ActivityPub endpoints (Actor, Inbox, Outbox, Followers, Following)
- [x] HTTP Signature verification for ActivityPub inbox
- [x] Well-known endpoints (WebFinger, NodeInfo, host-meta)
- [x] Profile follow endpoint (`POST /api/profiles/:username/follow`) with WebFinger resolution
  - Resolves `@user@domain` to actor URL and sends signed Follow
  - Inserts outgoing follow into DB for persistence

### Frontend (Next.js)
- [x] Basic page structure
- [x] TailwindCSS setup
- [x] Homepage
- [x] Post detail page with markdown rendering
- [x] Profile pages
- [x] TipTap/ProseMirror editor implementation
- [x] Onboarding page (placeholder)
- [x] Settings page (placeholder)
- [x] Search page (placeholder)
- [x] Feed redirect routes

### Worker
- [x] Worker structure
- [x] Redis integration
- [x] Federation delivery with HTTP Signatures
- [x] Retry logic with exponential backoff

## 🚧 In Progress / TODO

### Core Features
- [ ] Complete TipTap editor integration with API
- [ ] Media file serving optimization
- [ ] CSRF protection middleware
- [ ] Rate limiting middleware

### Frontend
- [ ] Complete onboarding wizard UI
- [ ] Post list with pagination
- [x] Profile editing UI
- [x] Settings UI
- [x] Dark mode implementation
- [ ] Responsive design polish
- [ ] Image upload in editor

### API
- [ ] Complete session handling improvements
- [ ] Error handling improvements
- [ ] Input validation enhancements
- [ ] Media file cleanup/management

### ActivityPub
- [ ] Better error handling for deliveries

### Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests

### Documentation
- [ ] API documentation
- [ ] Federation guide
- [ ] Deployment guide
- [ ] Development guide

## 📝 Notes

- Session management is implemented using JWT tokens stored in HTTP-only cookies
- Markdown rendering uses unified/remark/rehype pipeline with syntax highlighting
- TipTap editor is implemented with basic block support
- HTTP Signature verification works for local and remote users; remote actor key fetching implemented
- Inbox verification includes Digest matching, Date skew checks, and replay protection
- Federation delivery includes retry logic with exponential backoff
- Media uploads are stored locally; consider S3 integration for production

## 🚀 Getting Started

1. Install dependencies: `bun install`
2. Set up environment: Copy `infra/compose/.env.example` to `infra/compose/.env`
3. Start services: `docker-compose -f infra/compose/docker-compose.yml up -d`
4. Run migrations: `cd apps/api && bun run migrate`
5. Start development: `bun run dev`

### ActivityPub & Federation
- [x] Remote actor key fetching for signature verification (fetch actor, verify `publicKeyPem`)
- [x] Accept activity generation and sending on inbound Follow
- [x] Undo activity support (Follow, Like)
- [x] Outbox renders markdown to HTML for `Article.content`
- [x] Following persistence: DB migration `002_following` and real data at `GET /ap/users/:username/following`
- [x] Digest header validation and Date header freshness checks
- [x] Signature replay protection with short-lived cache
