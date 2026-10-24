import { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { getDb } from "@xlog/db";
import { getEnv } from "@xlog/config";
import { sign, verify } from "hono/jwt";
import { clearCsrfCookie, setCsrfCookie, CSRF_COOKIE_NAME } from "./csrf";

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
    /** Unix seconds JWT exp when authenticated */
    sessionExp?: number;
    /** How the request was authenticated */
    authMethod?: "cookie" | "bearer";
  }
}

export const SESSION_COOKIE_NAME = "xlog_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
/** Re-issue cookie when less than this many seconds remain (sliding window). */
export const SESSION_SLIDE_THRESHOLD_SEC = 60 * 60 * 24 * 2; // 2 days
const MOBILE_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface AuthPayload {
  userId: string;
  sessionId?: string;
  tokenType?: "session" | "mobile";
  exp: number;
}

type AuthResult =
  | { ok: false }
  | {
      ok: true;
      payload: AuthPayload;
      user: SessionUser;
    };

async function authenticateToken(token: string): Promise<AuthResult> {
  const env = getEnv();

  try {
    const payload = (await verify(token, env.SESSION_SECRET, "HS256")) as unknown as AuthPayload;
    if (!payload.userId || !payload.sessionId) {
      return { ok: false };
    }

    const db = getDb();
    const user = await db
      .selectFrom("users")
      .select(["id", "username", "email", "role", "is_active", "email_verified"])
      .where("id", "=", payload.userId)
      .executeTakeFirst();

    if (!user || user.is_active === false || user.email_verified === false) {
      return { ok: false };
    }

    const session = await db
      .selectFrom("auth_sessions")
      .select(["id", "expires_at", "revoked_at"])
      .where("id", "=", payload.sessionId)
      .where("user_id", "=", user.id)
      .executeTakeFirst();

    if (!session || session.revoked_at) {
      return { ok: false };
    }
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      return { ok: false };
    }

    return {
      ok: true,
      payload,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  } catch {
    return { ok: false };
  }
}

function applyAuth(
  c: Context,
  result: Extract<AuthResult, { ok: true }>,
  method: "cookie" | "bearer"
) {
  c.set("user", result.user);
  c.set("authMethod", method);
  if (result.payload.sessionId) {
    c.set("sessionId", result.payload.sessionId);
  }
  if (typeof result.payload.exp === "number") {
    c.set("sessionExp", result.payload.exp);
  }
}

export async function sessionMiddleware(c: Context, next: Next) {
  const sessionToken = getCookie(c, SESSION_COOKIE_NAME);
  const authHeader = c.req.header("authorization");

  if (sessionToken) {
    const result = await authenticateToken(sessionToken);
    if (!result.ok) {
      // Invalid session token, clear cookie
      deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
      clearCsrfCookie(c);
    } else {
      applyAuth(c, result, "cookie");
      if (!getCookie(c, CSRF_COOKIE_NAME)) {
        // Backfill CSRF cookie for sessions created before CSRF rolled out
        setCsrfCookie(c);
      }
      // Sliding session: extend the same session row and re-sign that id.
      const exp = result.payload.exp;
      const now = Math.floor(Date.now() / 1000);
      const remaining = exp - now;
      if (
        result.payload.sessionId &&
        result.payload.tokenType !== "mobile" &&
        remaining > 0 &&
        remaining < SESSION_SLIDE_THRESHOLD_SEC
      ) {
        const fresh = await refreshSession(result.user.id, result.payload.sessionId, "session");
        if (fresh) {
          setSessionCookie(c, fresh.token);
          c.set("sessionExp", fresh.exp);
        }
      }
    }
  }

  if (!c.get("user") && authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice("Bearer ".length).trim();
    const result = await authenticateToken(bearerToken);
    if (result.ok) {
      applyAuth(c, result, "bearer");
    }
  }

  await next();
}

export async function requireAuth(c: Context, next: Next) {
  const user = c.get("user");
  if (!user) {
    return c.json(
      { error: "Unauthorized", code: "unauthorized" },
      401
    );
  }
  await next();
}

export async function requireAdmin(c: Context, next: Next) {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized", code: "unauthorized" }, 401);
  }
  if (user.role !== "admin") {
    return c.json({ error: "Forbidden", code: "forbidden" }, 403);
  }
  await next();
}

/** Authors and admins may publish content; readers cannot. */
export async function requireAuthor(c: Context, next: Next) {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized", code: "unauthorized" }, 401);
  }
  if (user.role !== "admin" && user.role !== "author") {
    return c.json(
      { error: "Forbidden: author role required", code: "forbidden" },
      403
    );
  }
  await next();
}

async function insertSession(
  userId: string,
  tokenType: "session" | "mobile",
  maxAgeSec: number
): Promise<{ sessionId: string; exp: number }> {
  const sessionId = crypto.randomUUID();
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec;
  await getDb()
    .insertInto("auth_sessions")
    .values({
      id: sessionId,
      user_id: userId,
      token_type: tokenType,
      expires_at: new Date(exp * 1000),
      revoked_at: null,
    })
    .execute();
  return { sessionId, exp };
}

async function signSession(
  userId: string,
  sessionId: string,
  tokenType: "session" | "mobile",
  exp: number
): Promise<string> {
  return sign(
    { userId, sessionId, tokenType, exp },
    getEnv().SESSION_SECRET,
    "HS256"
  );
}

export async function createSession(userId: string): Promise<string> {
  const { sessionId, exp } = await insertSession(userId, "session", SESSION_MAX_AGE);
  return signSession(userId, sessionId, "session", exp);
}

export async function createMobileToken(userId: string): Promise<string> {
  const { sessionId, exp } = await insertSession(userId, "mobile", MOBILE_TOKEN_MAX_AGE);
  return signSession(userId, sessionId, "mobile", exp);
}

/** Extend expires_at on the same session id and return a new JWT for it. */
export async function refreshSession(
  userId: string,
  sessionId: string,
  tokenType: "session" | "mobile"
): Promise<{ token: string; exp: number } | null> {
  const maxAge = tokenType === "mobile" ? MOBILE_TOKEN_MAX_AGE : SESSION_MAX_AGE;
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const updated = await getDb()
    .updateTable("auth_sessions")
    .set({ expires_at: new Date(exp * 1000) })
    .where("id", "=", sessionId)
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .returning("id")
    .executeTakeFirst();
  if (!updated) return null;
  return { token: await signSession(userId, sessionId, tokenType, exp), exp };
}

export async function revokeSession(sessionId: string): Promise<void> {
  await getDb()
    .updateTable("auth_sessions")
    .set({ revoked_at: new Date() })
    .where("id", "=", sessionId)
    .where("revoked_at", "is", null)
    .execute();
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await getDb()
    .updateTable("auth_sessions")
    .set({ revoked_at: new Date() })
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .execute();
}

export function getMobileTokenExpiryIso() {
  return new Date(Date.now() + MOBILE_TOKEN_MAX_AGE * 1000).toISOString();
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  // Pair session with a double-submit CSRF token (readable by JS)
  setCsrfCookie(c);
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  clearCsrfCookie(c);
}
