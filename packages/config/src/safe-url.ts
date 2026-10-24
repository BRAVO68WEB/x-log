import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set([
  "metadata.google.internal",
  "metadata.goog",
  "metadata.google.com",
  "instance-data",
]);

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export function isBlockedIp(ip: string): boolean {
  const normalized = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const v4 = mapped ? mapped[1] : normalized;

  if (isIP(v4) === 4) {
    const parts = v4.split(".").map((p) => Number(p));
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }

  if (normalized.includes(":")) {
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fe80:")) return true;
    if (normalized.startsWith("ff")) return true;
    if (/^f[cd][0-9a-f]{0,2}:/.test(normalized) || /^f[cd][0-9a-f]{2}:/.test(normalized)) {
      return true;
    }
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    return false;
  }

  return true;
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type LookupFn = (hostname: string) => Promise<Array<{ address: string }>>;

export type AssertUrlOptions = {
  allowPrivate?: boolean;
  lookupImpl?: LookupFn;
};

function blockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTS.has(h) || h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal")) return true;
  return false;
}

export async function assertPublicUrl(raw: string, opts: AssertUrlOptions = {}): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs are allowed");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("URLs must not contain credentials");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) throw new UnsafeUrlError("Missing host");

  if (blockedHostname(host)) {
    if (!opts.allowPrivate) throw new UnsafeUrlError("Blocked host");
    return url;
  }

  if (/^\d+$/.test(host)) {
    throw new UnsafeUrlError("Numeric host is not allowed");
  }

  if (/^[0-9.]+$/.test(host)) {
    const parts = host.split(".");
    if (
      parts.length !== 4 ||
      parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255 || (p.length > 1 && p.startsWith("0")))
    ) {
      throw new UnsafeUrlError("Ambiguous IP address");
    }
    if (!opts.allowPrivate && isBlockedIp(host)) {
      throw new UnsafeUrlError("Blocked IP address");
    }
    return url;
  }

  if (isIP(host)) {
    if (!opts.allowPrivate && isBlockedIp(host)) {
      throw new UnsafeUrlError("Blocked IP address");
    }
    return url;
  }

  if (opts.allowPrivate) return url;

  const resolve = opts.lookupImpl ?? (async (hostname: string) => lookup(hostname, { all: true, verbatim: true }));
  let addrs: Array<{ address: string }>;
  try {
    addrs = await resolve(host);
  } catch {
    throw new UnsafeUrlError("DNS lookup failed");
  }
  if (addrs.length === 0) throw new UnsafeUrlError("DNS lookup failed");
  for (const addr of addrs) {
    if (isBlockedIp(addr.address)) {
      throw new UnsafeUrlError("Host resolves to a blocked address");
    }
  }
  return url;
}

export type SafeFetchInit = {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | null;
  redirect?: "follow" | "error" | "manual";
  signal?: AbortSignal;
};

export type SafeFetchOptions = AssertUrlOptions & {
  method?: string;
  headers?: Record<string, string> | Headers;
  body?: string | null;
  maxBytes?: number;
  timeoutMs?: number;
  /** Signed requests must not follow redirects. Default true for unfurl-style fetches. */
  followRedirects?: boolean;
  maxRedirects?: number;
  fetchImpl?: (input: string | URL, init?: SafeFetchInit) => Promise<Response>;
  signal?: AbortSignal;
};

async function readLimited(res: Response, maxBytes: number): Promise<Response> {
  const declared = res.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new UnsafeUrlError("Response too large");
  }
  if (!res.body) return res;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new UnsafeUrlError("Response too large");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const headers = new Headers(res.headers);
  headers.set("content-length", String(total));
  headers.delete("content-encoding");
  return new Response(buf, { status: res.status, statusText: res.statusText, headers });
}

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const fetcher = opts.fetchImpl ?? fetch;
  const maxBytes = opts.maxBytes ?? 1_048_576;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const follow = opts.followRedirects !== false;
  const maxRedirects = opts.maxRedirects ?? 3;
  let current = rawUrl;

  for (let hop = 0; hop <= (follow ? maxRedirects : 0); hop++) {
    const url = await assertPublicUrl(current, opts);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetcher(url.href, {
        method: opts.method,
        headers: opts.headers,
        body: hop === 0 ? opts.body : undefined,
        redirect: "manual",
        signal: controller.signal,
      });
      if (follow && res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new UnsafeUrlError("Redirect missing Location");
        current = new URL(loc, url).href;
        continue;
      }
      if (!follow && res.status >= 300 && res.status < 400) {
        throw new UnsafeUrlError("Redirects are not allowed for this request");
      }
      return await readLimited(res, maxBytes);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }
  }

  throw new UnsafeUrlError("Too many redirects");
}
