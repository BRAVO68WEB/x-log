# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile --production=false

# Copy API source
COPY apps/api ./apps/api
COPY turbo.json ./

# Build the API
RUN bun run build --filter=@xlog/api

# Production stage
FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV BUN_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 bunuser && \
    adduser --system --uid 1001 bunuser

# Copy package files and install production dependencies
COPY package.json bun.lockb* ./
COPY apps/api/package.json ./apps/api/
COPY packages ./packages

RUN bun install --frozen-lockfile --production

# Copy built files and source (Bun can run TS directly)
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src ./apps/api/src
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages ./packages

# Set correct permissions
RUN chown -R bunuser:bunuser /app

USER bunuser

EXPOSE 8080

ENV PORT=8080

WORKDIR /app/apps/api

CMD ["bun", "run", "dist/index.js"]

