# One-Click Deploy Templates

This directory contains templates for deploying xLog with one click to various platforms.

## Vercel

### Option 1: Deploy Button

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Bravo68web/x-Log)

### Option 2: Manual Configuration

1. Fork the xLog repository
2. Create a new project on Vercel
3. Import your forked repository
4. Configure environment variables:

- `DATABASE_URL` - PostgreSQL connection string (required)
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` - Your deployment URL

5. Deploy!

## Cloudflare Pages

### Option 1: Deploy Button

[![Deploy to Cloudflare Pages](https://pages.cloudflare.com/badge.svg)](https://pages.cloudflare.com/)

### Option 2: Manual Configuration

1. Fork the xLog repository
2. Go to Cloudflare Dashboard > Pages
3. Create a project > Connect to Git
4. Configure build settings:

- **Build command:** `bun run build`
- **Build output directory:** `apps/web/out`

5. Add environment variables
6. Deploy!

## Docker

For local development or self-hosting:

```bash
# Build the image
docker build -t xlog .

# Run with environment variables
docker run -p 3000:3000 \
 -e DATABASE_URL="postgresql://user:pass@host:5432/xlog" \
 -e NEXTAUTH_SECRET="your-secret-key" \
 -e NEXTAUTH_URL="http://localhost:3000" \
 xlog
```

Or use Docker Compose:

```bash
# Copy and configure
cp deploy/docker-compose.example.yml docker-compose.yml
# Edit docker-compose.yml with your settings
docker-compose up -d
```

## Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Connect your GitHub repository
2. Add PostgreSQL database
3. Configure environment variables
4. Deploy!

## Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch
fly launch

# Set secrets
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# Deploy
fly deploy
```

## Required Environment Variables

| Variable          | Description                  | Required |
| ----------------- | ---------------------------- | -------- |
| `DATABASE_URL`    | PostgreSQL connection string | Yes      |
| `NEXTAUTH_SECRET` | Session encryption secret    | Yes      |
| `NEXTAUTH_URL`    | Application URL              | Yes      |

## Optional Environment Variables

| Variable               | Description            |
| ---------------------- | ---------------------- |
| `RESEND_API_KEY`       | Email sending (Resend) |
| `SMTP_*`               | Email configuration    |
| `OPENAI_API_KEY`       | AI features            |
| `OPENAI_BASE_URL`      | OpenAI-compatible API  |
| `LOGTAIL_SOURCE_TOKEN` | Logging                |
