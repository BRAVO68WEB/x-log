# Build stage
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./
COPY apps/worker/package.json ./apps/worker/
COPY packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile --production=false

# Copy worker source
COPY apps/worker ./apps/worker
COPY turbo.json ./

# Build the worker
RUN bun run build --filter=@xlog/worker || echo "No build script, using source"

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
COPY apps/worker/package.json ./apps/worker/
COPY packages ./packages

RUN bun install --frozen-lockfile --production

# Copy built files or source (Bun can run TS directly)
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/src ./apps/worker/src
COPY --from=builder /app/apps/worker/package.json ./apps/worker/
COPY --from=builder /app/packages ./packages

# Set correct permissions
RUN chown -R bunuser:bunuser /app

USER bunuser

WORKDIR /app/apps/worker

# Run from dist if built, otherwise from src
CMD ["bun", "run", "src/index.ts"]

