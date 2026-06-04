# Multi-stage production Dockerfile for xLog

FROM oven/bun:1-alpine AS deps

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

FROM deps AS builder

WORKDIR /app

COPY . .
RUN bun run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install security updates and dependencies
RUN apk update && apk upgrade && \
 apk add --no-cache \
 openssl \
 ca-certificates \
 dumb-init \
 && rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
 adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/packages ./packages

# Set ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]