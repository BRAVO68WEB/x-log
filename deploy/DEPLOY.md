# x-log Deployment Guide

## Quick Deploy

### Option 1: Vercel + Supabase (Recommended for most users)

Best for: Quick setup, managed infrastructure, automatic HTTPS.

| Component | Provider | Cost |
|-----------|----------|------|
| Frontend (Next.js) | Vercel | Free tier available |
| Database (PostgreSQL) | Supabase | Free tier (500MB) |
| API + Worker | Railway / Render | ~$5-7/month |
| Redis (optional) | Upstash | Free tier (10K cmds/day) |

#### Step 1: Set up Supabase Database

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `deploy/supabase/setup.sql`
3. Copy your connection string from **Settings → Database → Connection string → URI**

#### Step 2: Deploy API + Worker on Railway

1. Go to [railway.app](https://railway.app) and create a new project
2. Deploy from GitHub repo, set root directory to `apps/api`
3. Add environment variables from `deploy/.env.production.example`
4. Repeat for `apps/worker` as a separate service
5. Copy the API service URL (e.g., `https://xlog-api.up.railway.app`)

#### Step 3: Deploy Frontend on Vercel

1. Fork this repo to your GitHub
2. Click the deploy button below, or:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your forked repo
   - Set root directory to `apps/web`
   - Add environment variables:
     - `BACKEND_API_URL` = your Railway API URL
     - `SESSION_SECRET` = generate with `openssl rand -base64 32`
     - `INSTANCE_DOMAIN` = your Vercel domain (e.g., `myblog.vercel.app`)
     - `OIDC_*` = your OIDC provider credentials

#### Step 4: Configure Instance

1. Visit your deployed site
2. Complete the onboarding wizard
3. Configure SMTP for password reset (optional)
4. Toggle feature flags in Settings → Features

---

### Option 2: Docker Compose (Self-hosted)

Best for: Full control, single-server deployment, existing infrastructure.

```bash
# Clone the repo
git clone https://github.com/BRAVO68WEB/x-log.git
cd x-log

# Set up environment
cp deploy/.env.production.example .env
# Edit .env with your values

# Start with Docker Compose
cd infra/compose
docker compose up -d

# Run migrations
docker compose exec api bun run migrate
```

**Services exposed:**
- Web: port 3000 (public)
- API: port 8080 (internal only)
- PostgreSQL: port 5432 (internal only)
- Redis: port 6379 (internal only)

**Production tips:**
- Use a reverse proxy (Nginx/Caddy) in front of port 3000
- Set `INSTANCE_DOMAIN` to your actual domain
- Configure SSL/TLS at the proxy level
- Set `SESSION_SECRET` to a strong random value

---

### Option 3: Docker (Single Container)

```bash
# Build
docker build -t xlog .

# Run (requires external PostgreSQL and Redis)
docker run -d \
  -p 3000:3000 \
  -p 8080:8080 \
  -e DATABASE_URL="postgres://..." \
  -e SESSION_SECRET="..." \
  -e INSTANCE_DOMAIN="myblog.com" \
  -e OIDC_CLIENT_ID="..." \
  -e OIDC_CLIENT_SECRET="..." \
  -e OIDC_REDIRECT_URI="..." \
  -e OIDC_DISCOVERY_URL="..." \
  ghcr.io/bravo68web/x-log:latest
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `SESSION_SECRET` | JWT signing key (min 32 chars) | `openssl rand -base64 32` |
| `INSTANCE_DOMAIN` | Your domain (no protocol) | `myblog.example.com` |
| `OIDC_CLIENT_ID` | OIDC client ID | From your provider |
| `OIDC_CLIENT_SECRET` | OIDC client secret | From your provider |
| `OIDC_REDIRECT_URI` | OIDC callback URL | `https://domain/auth/oidc/callback` |
| `OIDC_DISCOVERY_URL` | OIDC issuer discovery | `https://issuer/.well-known/openid-configuration` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis for federation queue | `redis://localhost:6379` |
| `SMTP_URL` | SMTP server for emails | (disabled) |
| `ADMIN_EMAIL` | Admin contact email | (none) |
| `INSTANCE_NAME` | Display name | `x-log` |
| `OPEN_REGISTRATIONS` | Allow sign-ups | `false` |
| `FEDERATION_ENABLED` | Enable ActivityPub | `true` |
| `BACKEND_API_URL` | Internal API URL | `http://localhost:8080` |

### Feature Flags (Optional)

Set to `true` or `false` to override admin UI settings:

```
FEATURE_CODE_SNIPPETS=false
FEATURE_LINK_ARCHIVE=false
FEATURE_AI_WRITER=false
FEATURE_PASSWORD_RESET=false
FEATURE_CUSTOM_POST_META=false
FEATURE_BOOKMARKS=false
FEATURE_REPOSTS=false
FEATURE_THREADS=false
FEATURE_SHORT_POSTS=false
FEATURE_SCHEDULED_POSTS=false
FEATURE_TRENDING=false
FEATURE_ANALYTICS=false
FEATURE_DMS=false
FEATURE_CUSTOM_THEMES=false
```

### AI Writer (Optional)

```
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
```

Supports any OpenAI-compatible endpoint (Ollama, Groq, etc.).

---

## Pre-deploy Validation

Run the pre-flight check before deploying:

```bash
./deploy/deploy.sh
```

This verifies all required environment variables are set and valid.

---

## Updating

### Vercel
Automatic deployments on push to `main`.

### Docker Compose
```bash
cd infra/compose
docker compose pull
docker compose up -d
docker compose exec api bun run migrate
```

### Railway
Automatic deployments on push to `main`. Migrations run on startup.

---

## Troubleshooting

**Database connection errors:**
- Verify `DATABASE_URL` format: `postgres://user:password@host:5432/dbname`
- For Supabase, use the connection pooling URL with `?pgbouncer=true`

**OIDC login fails:**
- Check `OIDC_REDIRECT_URI` matches your actual domain
- Ensure `OIDC_DISCOVERY_URL` is reachable from your server
- Verify client ID and secret with your OIDC provider

**Federation not working:**
- Ensure `INSTANCE_DOMAIN` matches your actual public domain
- Check that `/.well-known/webfinger` is accessible
- Verify Redis is running (used for delivery queue)

**Emails not sending:**
- Configure `SMTP_URL` (format: `smtps://user:pass@host:port`)
- Enable `FEATURE_PASSWORD_RESET=true`
