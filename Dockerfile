FROM oven/bun:1-alpine

WORKDIR /app

COPY . .

RUN bun install --frozen-lockfile

RUN bun run build

EXPOSE 8080
EXPOSE 4000

CMD ["bun", "run", "start"]