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

export async function sessionMiddleware(c: Context, next: Next) {
  const env = getEnv();
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);

  if (sessionToken) {
    try {
      const payload = await verify(sessionToken, env.SESSION_SECRET, "HS256");
      const db = getDb();

      const user = await db
        .selectFrom("users")
        .select(["id", "username", "email", "role"])
        .where("id", "=", payload.userId as string)
        .executeTakeFirst();

      if (user) {
        c.set("user", {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        });
        c.set("sessionId", payload.sessionId as string);
      }
    } catch (error) {
      // Invalid session token, clear cookie
      deleteCookie(c, SESSION_COOKIE_NAME);
    }
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
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  return await sign(payload, env.SESSION_SECRET, "HS256");
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

