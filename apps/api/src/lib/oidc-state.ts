import { createHmac, timingSafeEqual } from "crypto";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { getEnv } from "@xlog/config";

const COOKIE = "xlog_oidc";
const MAX_AGE = 60 * 10;

type OidcStatePayload = { state: string; nonce: string; exp: number };

function signPayload(payload: OidcStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", getEnv().SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${mac}`;
}

function readPayload(token: string): OidcStatePayload | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", getEnv().SESSION_SECRET).update(body).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OidcStatePayload;
    if (!payload.state || !payload.nonce || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function setOidcStateCookie(c: Context, state: string, nonce: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  setCookie(c, COOKIE, signPayload({ state, nonce, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}

export function readOidcStateCookie(c: Context): OidcStatePayload | null {
  const raw = getCookie(c, COOKIE);
  if (!raw) return null;
  return readPayload(raw);
}

export function clearOidcStateCookie(c: Context) {
  deleteCookie(c, COOKIE, { path: "/" });
}
