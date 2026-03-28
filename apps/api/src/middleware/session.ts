import { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { getDb } from "@xlog/db";
import { getEnv } from "@xlog/config";
import { sign, verify } from "hono/jwt";

export interface SessionUser {
  id: string;
  username: string;
  email: string | null;
  role: "admin" | "author" | "reader";
}

declare module "hono" {
  interface ContextVariableMap {
    user?: SessionUser;
    sessionId?: string;
  }
}

const SESSION_COOKIE_NAME = "xlog_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const MOBILE_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface AuthPayload {
  userId: string;
  sessionId?: string;
  tokenType?: "session" | "mobile";
  exp: number;
}

async function authenticateToken(c: Context, token: string) {
  const env = getEnv();

  try {
    const payload = await verify(token, env.SESSION_SECRET, "HS256") as unknown as AuthPayload;
    const db = getDb();

    const user = await db
      .selectFrom("users")
      .select(["id", "username", "email", "role"])
      .where("id", "=", payload.userId)
      .executeTakeFirst();

    if (!user) {
      return false;
    }

    c.set("user", {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
    if (payload.sessionId) {
      c.set("sessionId", payload.sessionId);
    }

    return true;
  } catch {
    return false;
  }
}

export async function sessionMiddleware(c: Context, next: Next) {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  const authHeader = c.req.header("authorization");

  if (sessionToken) {
    const isAuthenticated = await authenticateToken(c, sessionToken);
    if (!isAuthenticated) {
      // Invalid session token, clear cookie
      deleteCookie(c, SESSION_COOKIE_NAME);
    }
  }

  if (!c.get("user") && authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice("Bearer ".length).trim();
    await authenticateToken(c, bearerToken);
  }

  await next();
}

export async function requireAuth(c: Context, next: Next) {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}

export async function requireAdmin(c: Context, next: Next) {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
}

export async function createSession(userId: string): Promise<string> {
  const env = getEnv();
  const sessionId = crypto.randomUUID();
  const payload = {
    userId,
    sessionId,
    tokenType: "session" as const,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  return await sign(payload, env.SESSION_SECRET, "HS256");
}

export async function createMobileToken(userId: string): Promise<string> {
  const env = getEnv();
  const payload = {
    userId,
    tokenType: "mobile" as const,
    exp: Math.floor(Date.now() / 1000) + MOBILE_TOKEN_MAX_AGE,
  };
  return await sign(payload, env.SESSION_SECRET, "HS256");
}

export function getMobileTokenExpiryIso() {
  return new Date(Date.now() + MOBILE_TOKEN_MAX_AGE * 1000).toISOString();
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE_NAME);
}
