# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY apps/web/package.json ./apps/web/
COPY packages ./packages

# Install dependencies
RUN npm install -g bun@1.0.0 && \
    bun install --frozen-lockfile

# Copy web app source
COPY apps/web ./apps/web
COPY turbo.json ./

# Build the web app
RUN bun run build --filter=@xlog/web

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
# With standalone output, Next.js creates a minimal server structure
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 4000

ENV PORT=4000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]

