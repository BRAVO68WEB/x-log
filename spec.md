# x-log — A federated blog platform built on ActivityPub

An open-source, Bun + TypeScript powered blog platform that federates with the Fediverse using ActivityPub. Readers on Mastodon, Elk, Soapbox, and compatible clients can search, read, like, and follow x-log profiles and posts directly from their clients.

This document is the functional and technical specification for the project named “x-log”.



## 1) Goals and Non-Goals

- Goals
  - Self-hostable instance with onboarding journey (single or multi-user)
  - ActivityPub compatible: profiles discoverable via WebFinger; posts delivered via outbox; inbox for follows/likes
  - First-class blog UX with a Notion-like editor; Markdown-based renderer for published posts
  - RSS and Atom feeds for each author
  - Clean URL structure and snowflake IDs for posts
  - OpenAPI-described API; Zod-based validation
  - Deployed via Docker Compose
  - Monorepo with Turborepo; Bun as toolchain; Hono API; Next.js + TailwindCSS frontend; PostgreSQL + Kysely

- Non-Goals (initially)
  - Full Mastodon API compatibility
  - Advanced moderation tooling beyond basic block/allow lists and rate-limits
  - Media proxying/transcoding pipeline (basic image handling only at launch)



## 2) Tech Stack

- Tooling: Bun (runtime + package manager)
- Language: TypeScript
- API: Hono
- Validation: Zod (+ zod-to-openapi)
- Database: PostgreSQL + Kysely (with migrations)
- Frontend: Next.js (App Router) + TailwindCSS
- Monorepo: Turborepo
- Background jobs/queue: Redis + Worker (Bun)
- Deployment: Docker Compose
- Rendering: Markdown for published posts; block-based editor UI (Notion-like) with TipTap/ProseMirror



## 3) URL Structure

- Instance URL: https://{domain}
- Fediverse profile username/handle: @{username}@{domain}
- Profile URL: https://{domain}/profile (Note: Recommended to use /profile/{username} for multi-user instances; x-log will support both)
- Blog Post List (home): https://{domain}/
- Blog Post URL: https://{domain}/post/{unique-snowflake-id}
- Atom: https://{domain}/{username}.atom
- RSS: https://{domain}/{username}.rss

- ActivityPub & Well-known (content-negotiated as needed)
  - Actor: https://{domain}/ap/users/{username}
  - Inbox: https://{domain}/ap/users/{username}/inbox
  - Outbox: https://{domain}/ap/users/{username}/outbox
  - Followers: https://{domain}/ap/users/{username}/followers
  - Following: https://{domain}/ap/users/{username}/following
  - WebFinger: https://{domain}/.well-known/webfinger?resource=acct:{username}@{domain}
  - NodeInfo discovery: https://{domain}/.well-known/nodeinfo
  - NodeInfo 2.1: https://{domain}/nodeinfo/2.1
  - Host-meta (optional compatibility): https://{domain}/.well-known/host-meta and /host-meta.json



## 4) Federation: ActivityPub/ActivityStreams

- Objects
  - Person (author profile)
  - Article (blog post)
  - Follow, Accept, Undo, Like, Create activities

- Content negotiation
  - Endpoints under /ap/ return application/activity+json
  - Public user/profile routes return HTML; with Accept: application/activity+json redirect or serve the actor object

- Actor (Person)
  - id: https://{domain}/ap/users/{username}
  - inbox/outbox URLs as above
  - publicKey: actor-level key pair; http-signatures for deliveries
  - name/displayName = author full name; preferredUsername = username
  - summary HTML includes profile bio and links

- WebFinger (JRD)
  - Resource: acct:{username}@{domain}
  - Links: rel=self (actor id), profile-page (HTML), also possibly subscribe (template) for client UX

- Outbox
  - Paginates ordered Create activities for Article posts
  - Collection pages via id?page=true; next/prev via Link headers or collection page properties

- Inbox
  - Validates HTTP Signature (Cavage-style), content type activity+json
  - Accepts Follow -> creates follower record; returns Accept activity
  - Accepts Like -> increments like counter on post (local denormalization)

- Delivery
  - On publish, server composes Create{Article} and delivers to followers’ inboxes
  - Background job signs requests and delivers with retries + exponential backoff
  - Stores per-delivery status for observability

- NodeInfo 2.1
  - software.name: "x-log"
  - protocols: ["activitypub"]
  - users stats, localPosts, openRegistrations: boolean

- Security
  - HTTP Signatures for server-to-server
  - JSON-LD context for activities/objects
  - Request canonicalization; digest headers
  - Verification of actor keyId and embedded public key on follow/like/create
  - Instance-level allowlist/denylist for domains
  - Rate limiting on inbox endpoints



## 5) Data Model (PostgreSQL via Kysely)

Core tables (suggested):

- users
  - id (uuid, PK)
  - username (unique)
  - email (unique, nullable for CLI-created users)
  - password_hash (nullable if passwordless)
  - role (enum: admin|author|reader)
  - created_at, updated_at

- user_profiles
  - user_id (FK users.id)
  - full_name
  - bio
  - social_github
  - social_x
  - social_youtube
  - social_reddit
  - social_linkedin
  - social_website
  - support_url
  - support_text
  - avatar_url
  - banner_url

- user_keys
  - user_id (FK users.id)
  - public_key_pem (text)
  - private_key_pem (text, encrypted at rest)
  - key_id (string, e.g., https://{domain}/ap/users/{username}#main-key)
  - created_at

- posts
  - id (string, snowflake)
  - author_id (FK users.id)
  - title
  - banner_url
  - content_markdown (text)
  - content_blocks_json (jsonb)  // internal, for editor state
  - summary (string, optional)
  - hashtags (text[]) // denormalized; also relation table below if needed
  - like_count (int, default 0)   // denormalized from federation interactions
  - published_at (timestamp)
  - updated_at
  - visibility (enum: public|unlisted|private)
  - ap_object_id (string, unique) // canonical object URL: https://{domain}/post/{id}

- post_hashtags (optional normalized)
  - post_id (FK posts.id)
  - tag (lowercase)
  - unique(post_id, tag)

- followers
  - id (uuid, PK)
  - local_user_id (FK users.id)
  - remote_actor (text, unique with local_user_id)
  - inbox_url (text)
  - approved (bool) // reserved if manual approval is added
  - created_at

- deliveries
  - id (uuid, PK)
  - activity_id (text) // internal ID of outbox activity
  - remote_inbox (text)
  - status (enum: pending|sent|failed|retrying)
  - attempt_count (int)
  - last_error (text)
  - updated_at

- inbox_objects
  - id (uuid, PK)
  - type (string)
  - actor (text)
  - object_id (text)
  - raw (jsonb)
  - received_at

- instance_settings
  - id (singleton PK = 1)
  - instance_name
  - instance_description
  - instance_domain
  - open_registrations (bool)
  - admin_email
  - smtp_url (nullable)
  - federation_enabled (bool)
  - created_at, updated_at

Indexes:
- users.username unique
- posts.author_id, posts.published_at DESC
- GIN index on posts.content_markdown (via tsvector) for full-text search
- GIN on posts.hashtags
- followers (local_user_id, remote_actor) unique



## 6) Monorepo Structure (Turborepo)

- apps/
  - web/ (Next.js + TailwindCSS)
  - api/ (Hono API)
  - worker/ (Bun worker for federation delivery and scheduled jobs)

- packages/
  - db/ (Kysely DB client, schema, migrations)
  - validation/ (Zod schemas)
  - ap/ (ActivityPub helpers: signature, LD contexts, formatters)
  - snowflake/ (ID generator)
  - config/ (shared config, env parsing)
  - ui/ (shared UI components, Tailwind presets)
  - types/ (shared TS types, OpenAPI typings)

- infra/
  - docker/ (Dockerfiles)
  - compose/ (docker-compose.yml, .env.example, init SQL)
  - nginx/ or caddy/ (optional reverse proxy config)

- docs/
  - x-log-spec.md (this file)
  - api.md (generated OpenAPI notes)
  - federation.md (protocol details)



## 7) API Design (Hono + Zod + OpenAPI)

- Base URL: https://{domain}/api
- OpenAPI route:
  - GET /api/openapi.json (application/json)
  - GET /api/docs (Swagger UI or RapiDoc)
- Auth
  - Session cookie for dashboard (CSRF-protected)
  - Admin bootstrap token for onboarding

- Core endpoints (MVP)
  - Auth
    - POST /api/auth/login
    - POST /api/auth/logout
  - Onboarding
    - GET /api/onboarding/state
    - POST /api/onboarding/complete
  - Users
    - GET /api/users/me
    - PATCH /api/users/me
  - Profiles
    - GET /api/profiles/:username
    - PATCH /api/profiles/:username
  - Posts
    - GET /api/posts?author=:username&limit=&cursor=
    - GET /api/posts/:id
    - POST /api/posts
    - PATCH /api/posts/:id
    - DELETE /api/posts/:id
    - POST /api/posts/:id/publish
  - Feeds
    - GET /api/feeds/:username/rss
    - GET /api/feeds/:username/atom
  - Search
    - GET /api/search?q=&type=post|profile

- Federation endpoints (public)
  - GET /.well-known/webfinger
  - GET /.well-known/nodeinfo
  - GET /nodeinfo/2.1
  - GET /.well-known/host-meta (optional)
  - GET /.well-known/host-meta.json (optional)
  - GET /ap/users/:username
  - GET /ap/users/:username/outbox
  - GET /ap/users/:username/followers
  - GET /ap/users/:username/following
  - POST /ap/users/:username/inbox

- Validation
  - All request/response bodies validated via Zod; OpenAPI generated with zod-to-openapi
  - Error format: RFC 7807 problem+json

Example Zod schema (simplified):

```ts
import { z } from "zod";

export const PostCreateSchema = z.object({
  title: z.string().min(1).max(200),
  banner_url: z.string().url().optional(),
  content_blocks: z.array(z.any()).min(1), // editor state; validated per-node type in practice
  content_markdown: z.string().min(1),
  hashtags: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/i)).max(20),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
});

export const PostResponseSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  banner_url: z.string().url().optional(),
  content_html: z.string(), // rendered from markdown
  content_markdown: z.string(),
  hashtags: z.array(z.string()),
  like_count: z.number().int(),
  author: z.object({
    username: z.string(),
    full_name: z.string().optional(),
    avatar_url: z.string().url().optional(),
  }),
  published_at: z.string(),
  updated_at: z.string(),
});
```

OpenAPI route wiring (Hono):

```ts
// apps/api/src/routes/openapi.ts
import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import { PostCreateSchema, PostResponseSchema } from "@xlog/validation";
const app = new OpenAPIHono();

app.openapi(
  {
    method: "get",
    path: "/openapi.json",
    operationId: "getOpenAPI",
    tags: ["meta"],
    responses: {
      200: {
        description: "OpenAPI spec",
        content: {
          "application/json": {
            schema: z.any(),
          },
        },
      },
    },
  },
  (c) => c.json(c.getOpenAPIDocument(), 200)
);

export default app;
```



## 8) Frontend (Next.js + TailwindCSS)

- Pages/Routes
  - /                             Home: list of recent posts
  - /post/[id]                    Post detail (rendered from Markdown to HTML; clean typography)
  - /profile                      Current user profile (for single-user mode)
  - /u/[username]                 Public profile (multi-user mode)
  - /editor                       Notion-like editor for creating/updating posts
  - /onboarding                   Instance setup wizard
  - /settings                     Admin settings for instance
  - /search                       Global search (posts/profiles)

- Editor (Notion-like)
  - TipTap/ProseMirror-based block editor
  - Blocks: Heading, Paragraph, Image, Code Block, Quote, Bulleted List, Numbered List, Toggle, Divider
  - Metadata fields: Title, Banner_URL, Hashtags
  - Markdown export on publish; store editor state JSON for round-trip editing
  - Keyboard-driven commands (e.g., “/” menu)

- Rendering
  - Render Markdown with a secure renderer (rehype/remark pipeline)
  - Syntax highlighting for code blocks (Shiki/Prism)
  - Responsive banner image, accessible image alt attributes
  - Open Graph and Twitter card tags for sharing

- UX
  - Clean typography, spacing, and reading width constraints
  - Dark mode
  - Accessible focus states and semantic HTML
  - Optimistic UI for save/publish
  - Pagination/infinite scroll on lists



## 9) Feeds: Atom and RSS

- Per-user feeds:
  - GET /{username}.atom -> application/atom+xml
  - GET /{username}.rss -> application/rss+xml
- Includes latest N public posts; content derived from Markdown to HTML summary/content
- Correct cache headers (ETag/Last-Modified)



## 10) Onboarding Flow (Instance Setup)

- Step 1: Welcome & prerequisites check (database connectivity; domain)
- Step 2: Instance settings (name, description, domain, admin email, open registrations?)
- Step 3: SMTP configuration (optional)
- Step 4: Admin user creation (username, password)
- Step 5: Federation keys generation (server signing keys)
- Step 6: Finalize and launch

- On first run, API exposes /api/onboarding/state and /api/onboarding/complete
- Locks onboarding after completion; can be reset with admin CLI or env flag



## 11) Search

- Local full-text search leveraging Postgres tsvector on:
  - posts.content_markdown
  - posts.title
  - user_profiles.full_name, users.username

- API: GET /api/search?q=&type=post|profile
- Profile discoverability in Fediverse primarily via WebFinger and NodeInfo; Mastodon remote search is enabled by correct WebFinger responses and actor URLs



## 12) Snowflake ID Strategy

- 64-bit sortable ID based on timestamp, workerId, sequence
- Service: packages/snowflake with pluggable epoch and worker ID sourcing
- Ensures unique post URLs and chronological ordering without DB round trips



## 13) Background Jobs

- Queue: Redis
- Jobs:
  - Federation delivery (Create, Accept)
  - Retry failed deliveries
  - Rebuild feeds
  - Periodic NodeInfo stats refresh
- Worker service (apps/worker) consumes queue; Bun runtime



## 14) Security and Compliance

- HTTP Signatures verification for inbox
- CSRF protection for session-auth endpoints
- Rate limits on public and inbox endpoints
- Input sanitization and XSS-safe rendering
- Secrets management via environment variables
- Encrypted storage for private keys (KMS or sealed box optional)
- CORS: restricted origins for API
- Logging and audit trails for admin actions



## 15) Deployment (Docker Compose)

Services:
- db: postgres:16
- redis: redis:7
- api: oven/bun:1 (Hono)
- web: oven/bun:1 (Next.js)
- worker: oven/bun:1
- proxy: optional caddy/nginx for TLS + reverse proxy

Environment variables (.env):
- DATABASE_URL=postgres://user:pass@db:5432/xlog
- REDIS_URL=redis://redis:6379
- NODE_ENV=production
- INSTANCE_DOMAIN=example.com
- INSTANCE_NAME="My x-log"
- ADMIN_EMAIL=admin@example.com
- OPEN_REGISTRATIONS=false
- SMTP_URL=smtp://user:pass@smtp:587
- SESSION_SECRET=...
- FEDERATION_ENABLED=true

Compose responsibilities:
- Build images for web/api/worker
- Run migrations on startup (api)
- Healthchecks for db/api/web
- Shared network and volumes for persistence (db data)



## 16) Example ActivityPub Payloads

- Person (Actor) minimal:

```json
{
  "@context": [
    "https://www.w3.org/ns/activitystreams",
    "https://w3id.org/security/v1"
  ],
  "id": "https://{domain}/ap/users/{username}",
  "type": "Person",
  "preferredUsername": "{username}",
  "name": "{Full Name}",
  "summary": "<p>Bio and social links</p>",
  "inbox": "https://{domain}/ap/users/{username}/inbox",
  "outbox": "https://{domain}/ap/users/{username}/outbox",
  "followers": "https://{domain}/ap/users/{username}/followers",
  "following": "https://{domain}/ap/users/{username}/following",
  "publicKey": {
    "id": "https://{domain}/ap/users/{username}#main-key",
    "owner": "https://{domain}/ap/users/{username}",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
  }
}
```

- Create Article:

```json
{
  "@context": ["https://www.w3.org/ns/activitystreams"],
  "id": "https://{domain}/ap/activities/{uuid}",
  "type": "Create",
  "actor": "https://{domain}/ap/users/{username}",
  "published": "2025-01-01T12:00:00Z",
  "to": ["https://www.w3.org/ns/activitystreams#Public"],
  "object": {
    "id": "https://{domain}/post/{snowflake}",
    "url": "https://{domain}/post/{snowflake}",
    "type": "Article",
    "attributedTo": "https://{domain}/ap/users/{username}",
    "name": "Post Title",
    "summary": "Optional summary",
    "content": "<p>Rendered HTML content</p>",
    "tag": [
      { "type": "Hashtag", "name": "#tag1" },
      { "type": "Hashtag", "name": "#tag2" }
    ],
    "image": "https://{domain}/media/banners/abc.jpg",
    "published": "2025-01-01T12:00:00Z"
  }
}
```



## 17) Well-Known and NodeInfo

- /.well-known/webfinger -> application/jrd+json
- /.well-known/nodeinfo -> links to /nodeinfo/2.1
- /nodeinfo/2.1 -> JSON with software and usage stats
- /.well-known/host-meta (XML/XRD) and /.well-known/host-meta.json (JRD) to assist certain clients
- Content negotiation and correct caching headers



## 18) Implementation Notes

- Hono API
  - Mount routes: /api/* for internal app API; /ap/* and /.well-known/* for federation
  - Sign/verify middleware for HTTP signatures
  - Rate limit middleware for inbox

- Kysely
  - Define schema interfaces in packages/db
  - Migrations via Kysely migrator; compose task to run on startup

- Markdown rendering
  - remark-parse + remark-gfm + rehype-sanitize + rehype-highlight
  - Ensure only safe HTML is emitted

- Editor state to Markdown
  - Conversion implemented on publish
  - Store both raw editor JSON and markdown for transparency and portability

- OpenAPI
  - Define Zod schemas in packages/validation
  - Use @hono/zod-openapi or zod-to-openapi to generate the spec
  - Serve at /api/openapi.json; docs at /api/docs



## 19) MVP Scope

- Single instance with:
  - Onboarding wizard
  - Single or limited multi-author mode
  - Create/edit/publish posts with Notion-like editor
  - Markdown rendering with great typography
  - ActivityPub: WebFinger, Person, Outbox, Inbox (Follow, Accept, Create, Like)
  - Atom/RSS feeds per user
  - OpenAPI route with basic endpoints

- Phase 2
  - UI polish and themeing
  - Better moderation/blocks
  - Media management enhancements
  - Web push notifications
  - Import/export content



## 20) License and Governance

- License: AGPL-3.0 or MIT (to be decided based on federation ecosystem expectations; Mastodon uses AGPL-3.0)
- Code of Conduct and contributing guidelines in repo root



## 21) Acceptance Criteria Summary

- Profiles discoverable from Mastodon/Elk/Soapbox via WebFinger and ActivityPub actor endpoint
- Remote users can Follow, Like, and fetch posts via ActivityPub
- Posts have stable URLs with snowflake IDs
- Feeds available at /{username}.atom and /{username}.rss
- OpenAPI spec served at /api/openapi.json
- Onboarding journey completes instance setup
- Database schema and migrations provided
- Deployed locally via Docker Compose with working services



## 22) Example Docker Compose (outline)

```yaml
version: "3.9"
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: xlog
      POSTGRES_USER: xlog
      POSTGRES_PASSWORD: xlogpass
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U xlog"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7
    command: ["redis-server", "--appendonly", "yes"]
    volumes:
      - redis_data:/data

  api:
    image: oven/bun:1
    working_dir: /app/apps/api
    env_file:
      - ./compose/.env
    volumes:
      - ./:/app
    command: ["bun", "start"] # e.g., bun run start
    depends_on:
      - db
      - redis
    ports:
      - "8080:8080"

  web:
    image: oven/bun:1
    working_dir: /app/apps/web
    env_file:
      - ./compose/.env
    volumes:
      - ./:/app
    command: ["bun", "start"] # next start, wrapped by bun
    depends_on:
      - api
    ports:
      - "3000:3000"

  worker:
    image: oven/bun:1
    working_dir: /app/apps/worker
    env_file:
      - ./compose/.env
    volumes:
      - ./:/app
    command: ["bun", "start"]
    depends_on:
      - redis
      - db

volumes:
  db_data:
  redis_data:
```



## 23) Open Questions

- Should profile URL be /profile or /u/{username}? For multi-user, /u/{username} is preferred; we will support /profile for current user.
- License choice: AGPL-3.0 vs MIT
- Media storage: local vs S3-compatible; MVP: local disk
- Registration model: invite-only vs open registrations default



---
End of spec for x-log.