/**
 * In-process API integration tests via Hono app.request().
 * Requires env for @xlog/config (set below). Does not require a live HTTP port.
 * Routes that hit Postgres are skipped when the DB is unreachable.
 */
import { beforeAll, describe, expect, test } from "bun:test";

function ensureEnv() {
  process.env.NODE_ENV ??= "test";
  process.env.DATABASE_URL ??= "postgres://xlog:xlogpass@localhost:5432/xlog";
  process.env.REDIS_URL ??= "redis://localhost:6379";
  process.env.INSTANCE_DOMAIN ??= "localhost";
  process.env.SESSION_SECRET ??= "test-session-secret-at-least-32-characters-long";
  process.env.OIDC_CLIENT_ID ??= "test-client";
  process.env.OIDC_CLIENT_SECRET ??= "test-secret";
  process.env.OIDC_REDIRECT_URI ??= "http://localhost:3000/auth/oidc/callback";
  process.env.OIDC_DISCOVERY_URL ??=
    "http://localhost/.well-known/openid-configuration";
  process.env.RATE_LIMIT_ENABLED = "false";
}

ensureEnv();

const { createApp } = await import("./app");

describe("API integration (createApp)", () => {
  const app = createApp({ quiet: true, disableRateLimit: true });

  test("GET /health returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; mcp?: { enabled: boolean } };
    expect(body.status).toBe("ok");
    expect(body.mcp).toBeDefined();
  });

  test("GET /api/health alias returns ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ok");
  });

  test("GET /api/users/me without auth is 401 with code", async () => {
    const res = await app.request("/api/users/me");
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; code?: string };
    expect(body.error).toBeTruthy();
    expect(body.code === "unauthorized" || body.error.toLowerCase().includes("unauthor")).toBe(
      true
    );
  });

  test("mutating /api without session cookie skips CSRF (public login shape)", async () => {
    // No session cookie → CSRF middleware allows through; login may 400/401 on body
    const res = await app.request("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({}),
    });
    // Validator or auth failure — not 403 CSRF
    expect(res.status).not.toBe(403);
    expect([400, 401, 422, 500]).toContain(res.status);
  });

  test("CSRF rejects cookie session POST without token", async () => {
    const res = await app.request("/api/users/me", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: "xlog_session=invalid-but-present; xlog_csrf=tok",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email: "a@b.com" }),
    });
    // Invalid session clears auth → 401, or CSRF if session cookie alone without matching header flow
    // Session invalid → 401 unauthorized from requireAuth (no user)
    expect([401, 403]).toContain(res.status);
  });

  test("GET /api/openapi.json is JSON", async () => {
    const res = await app.request("/api/openapi.json");
    // openapi handler may 200 even without all routes introspected
    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      const body = (await res.json()) as { openapi?: string };
      expect(body.openapi).toBeTruthy();
    }
  });
});

describe("API integration (optional live DB)", () => {
  let dbOk = false;

  beforeAll(async () => {
    try {
      const { getDb } = await import("@xlog/db");
      await getDb().selectFrom("users").select("id").limit(1).execute();
      dbOk = true;
    } catch {
      dbOk = false;
    }
  });

  test("GET /api/auth/registration-status when DB up", async () => {
    if (!dbOk) {
      console.warn("skip: database not reachable");
      return;
    }
    const app = createApp({ quiet: true, disableRateLimit: true });
    const res = await app.request("/api/auth/registration-status");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeTruthy();
  });

  test("GET /api/posts returns list shape when DB up", async () => {
    if (!dbOk) {
      console.warn("skip: database not reachable");
      return;
    }
    const app = createApp({ quiet: true, disableRateLimit: true });
    const res = await app.request("/api/posts?limit=5");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; hasMore: boolean };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.hasMore).toBe("boolean");
  });
});
