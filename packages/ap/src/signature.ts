import crypto from "crypto";
import { getDb, getInstanceSettings } from "@xlog/db";

const SIGNATURE_TTL_MS = 15 * 60 * 1000;
/** How long cached remote public keys remain valid before re-fetch. */
const REMOTE_KEY_TTL_MS = 24 * 60 * 60 * 1000;
const ACTIVITYPUB_ACCEPT_HEADER =
  'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

export interface SignatureHeaders {
  "(request-target)": string;
  host: string;
  date: string;
  digest?: string;
  "content-type"?: string;
  accept?: string;
}

export type SignedRequest = {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
};

export type SignRequestOptions = {
  method: string;
  url: string;
  body?: string;
  userId: string;
  extraHeaders?: Record<string, string>;
};

export type VerifySignatureOptions = {
  /** Local user whose key is used to signed-GET remote actor keys (authorized fetch). */
  keyFetchSignerUserId?: string;
};

export function createSignatureString(headers: SignatureHeaders): string {
  return Object.entries(headers)
    .map(([key, value]) => `${key.toLowerCase()}: ${value}`)
    .join("\n");
}

export function computeDigest(body: string): string {
  return `SHA-256=${crypto.createHash("sha256").update(body).digest("base64")}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeActorUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    url.pathname = trimTrailingSlash(url.pathname) || "/";
    return url.toString();
  } catch {
    return trimTrailingSlash(value);
  }
}

function normalizeKeyId(value: string): string {
  try {
    const url = new URL(value);
    url.pathname = trimTrailingSlash(url.pathname) || "/";
    return url.toString();
  } catch {
    return value;
  }
}

function normalizeActorHostname(value: string): string {
  return value.replace(/^www\./, "");
}

function actorUrlsEquivalent(left: string, right: string): boolean {
  try {
    const a = new URL(normalizeActorUrl(left));
    const b = new URL(normalizeActorUrl(right));
    return (
      a.protocol === b.protocol &&
      normalizeActorHostname(a.hostname) === normalizeActorHostname(b.hostname) &&
      a.pathname === b.pathname
    );
  } catch {
    return normalizeActorUrl(left) === normalizeActorUrl(right);
  }
}

function keyIdsEquivalent(left: string, right: string): boolean {
  try {
    const a = new URL(normalizeKeyId(left));
    const b = new URL(normalizeKeyId(right));
    return (
      a.protocol === b.protocol &&
      normalizeActorHostname(a.hostname) === normalizeActorHostname(b.hostname) &&
      a.pathname === b.pathname &&
      a.hash === b.hash
    );
  } catch {
    return normalizeKeyId(left) === normalizeKeyId(right);
  }
}

function getActorIdFromUrl(actorUrl: string): string {
  try {
    const parts = new URL(actorUrl).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    return actorUrl.split("/").filter(Boolean).pop() || "";
  }
}

function actorUrlFromKeyId(keyId: string): string {
  try {
    const url = new URL(keyId);
    url.hash = "";
    return url.toString();
  } catch {
    return keyId.replace(/#.*$/, "");
  }
}

/**
 * Candidate actor URLs for key fetch.
 * Only the original host (plus trailing-slash variants) — never invent www.
 * Probing www.mastodon.social for mastodon.social causes ERR_TLS_CERT_ALTNAME_INVALID
 * and noisy stack traces in production.
 */
function buildRemoteActorCandidates(actorUrl: string): string[] {
  const candidates = new Set<string>();

  const add = (value: string) => {
    if (value.startsWith("https://")) {
      candidates.add(value);
    }
  };

  try {
    const url = new URL(actorUrl);
    url.hash = "";

    add(url.toString());

    const withoutSlash = new URL(url.toString());
    withoutSlash.pathname = trimTrailingSlash(withoutSlash.pathname) || "/";
    add(withoutSlash.toString());

    const withSlash = new URL(withoutSlash.toString());
    if (!withSlash.pathname.endsWith("/")) {
      withSlash.pathname = `${withSlash.pathname}/`;
      add(withSlash.toString());
    }

    // If the keyId host is already www., also try apex (same cert often covers both
    // the other way; apex→www is unsafe and was the production noise source).
    if (url.hostname.startsWith("www.") && url.hostname.split(".").length >= 3) {
      const apex = new URL(withoutSlash.toString());
      apex.hostname = url.hostname.slice(4);
      add(apex.toString());
      if (!apex.pathname.endsWith("/")) {
        const apexSlash = new URL(apex.toString());
        apexSlash.pathname = `${apex.pathname}/`;
        add(apexSlash.toString());
      }
    }
  } catch {
    add(actorUrl);
  }

  return [...candidates];
}

function formatFetchError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string; path?: string };
    if (e.code) {
      return `${e.code}${e.path ? ` ${e.path}` : e.message ? `: ${e.message}` : ""}`;
    }
    if (e.message) return e.message;
  }
  return String(err);
}

async function resolveKeyFetchSignerUserId(preferred?: string): Promise<string | null> {
  if (preferred) return preferred;

  const db = getDb();
  const admin = await db
    .selectFrom("users")
    .innerJoin("user_keys", "user_keys.user_id", "users.id")
    .select("users.id")
    .where("users.role", "=", "admin")
    .orderBy("users.created_at", "asc")
    .executeTakeFirst();

  if (admin) return admin.id;

  const any = await db
    .selectFrom("users")
    .innerJoin("user_keys", "user_keys.user_id", "users.id")
    .select("users.id")
    .orderBy("users.created_at", "asc")
    .executeTakeFirst();

  return any?.id ?? null;
}

export type SignHttpRequestOptions = {
  method: string;
  url: string;
  body?: string;
  privateKeyPem: string;
  keyId: string;
  extraHeaders?: Record<string, string>;
  /** Fixed Date for tests; defaults to now. */
  date?: string;
};

export type ParsedSignatureHeader = {
  keyId?: string;
  algorithm?: string;
  headers?: string;
  signature?: string;
};

/** Parse a Cavage-style Signature header into key/value pairs. */
export function parseSignatureHeader(signatureHeader: string): ParsedSignatureHeader {
  const parts: ParsedSignatureHeader = {};
  // Support keyId="...", keyId='...', and unquoted simple tokens
  const re = /(\w+)=(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(signatureHeader)) !== null) {
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    (parts as Record<string, string>)[match[1]] = value;
  }
  return parts;
}

/** True when the Signature header uses RFC 9421 dictionary form (`sig1=:...:`). */
export function isRfc9421SignatureHeader(signatureHeader: string): boolean {
  return /=\s*:/.test(signatureHeader) && !/keyId\s*=/i.test(signatureHeader);
}

export type Rfc9421Signature = {
  label: string;
  /** Covered components, e.g. ["@method", "@authority", "date"] */
  components: string[];
  /** Raw inner-list + params value used as @signature-params (no label) */
  signatureParams: string;
  keyId: string;
  algorithm?: string;
  created?: number;
  expires?: number;
  /** Raw signature bytes (base64, no surrounding `:`) */
  signatureBase64: string;
};

/**
 * Parse RFC 9421 Signature + Signature-Input pair.
 * Example:
 *   Signature-Input: sig1=("@method" "@path");created=1;keyid="https://…#main-key"
 *   Signature: sig1=:BASE64:
 */
export function parseRfc9421Signatures(
  signatureHeader: string,
  signatureInputHeader: string
): Rfc9421Signature[] {
  if (!signatureHeader || !signatureInputHeader) return [];

  const sigValues = parseSfDictionaryByteSequences(signatureHeader);
  const inputs = parseSfDictionaryInnerLists(signatureInputHeader);
  const out: Rfc9421Signature[] = [];

  for (const [label, input] of Object.entries(inputs)) {
    const sigB64 = sigValues[label];
    if (!sigB64) continue;
    const keyId = input.params.keyid || input.params.keyId;
    if (!keyId) continue;

    out.push({
      label,
      components: input.items,
      signatureParams: input.rawParams,
      keyId,
      algorithm: input.params.alg,
      created: input.params.created ? Number(input.params.created) : undefined,
      expires: input.params.expires ? Number(input.params.expires) : undefined,
      signatureBase64: sigB64,
    });
  }

  return out;
}

/** Extract keyId from Cavage Signature or RFC 9421 Signature-Input. */
export function extractSignatureKeyId(
  signatureHeader: string,
  signatureInputHeader?: string | null
): string | null {
  const cavage = parseSignatureHeader(signatureHeader);
  if (cavage.keyId) return cavage.keyId;

  if (signatureInputHeader) {
    const rfc = parseRfc9421Signatures(signatureHeader, signatureInputHeader);
    if (rfc[0]?.keyId) return rfc[0].keyId;
  }

  // Signature-Input alone (some gateways strip pairing)
  if (signatureInputHeader) {
    const m = signatureInputHeader.match(/keyid="([^"]+)"/i);
    if (m?.[1]) return m[1];
  }

  return null;
}

/**
 * Minimal Structured Fields dictionary parser for RFC 9421 byte sequences:
 *   sig1=:YmFzZTY0:, sig2=:abc=
 */
function parseSfDictionaryByteSequences(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z0-9_*-]+)=\s*:([A-Za-z0-9+/=]*):/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header)) !== null) {
    out[m[1]] = m[2];
  }
  return out;
}

/**
 * Parse Signature-Input dictionary members:
 *   sig1=("@method" "@path" "date");created=123;keyid="https://…"
 */
function parseSfDictionaryInnerLists(header: string): Record<
  string,
  { items: string[]; params: Record<string, string>; rawParams: string }
> {
  const out: Record<
    string,
    { items: string[]; params: Record<string, string>; rawParams: string }
  > = {};

  // Split top-level members on commas not inside quotes/parens
  const members: string[] = [];
  let buf = "";
  let depth = 0;
  let inQuote = false;
  for (let i = 0; i < header.length; i++) {
    const ch = header[i];
    if (ch === '"' && header[i - 1] !== "\\") inQuote = !inQuote;
    if (!inQuote) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        members.push(buf.trim());
        buf = "";
        continue;
      }
    }
    buf += ch;
  }
  if (buf.trim()) members.push(buf.trim());

  for (const member of members) {
    const eq = member.indexOf("=");
    if (eq < 0) continue;
    const label = member.slice(0, eq).trim();
    const rest = member.slice(eq + 1).trim();
    const parenEnd = rest.indexOf(")");
    if (!rest.startsWith("(") || parenEnd < 0) continue;

    const listInner = rest.slice(1, parenEnd);
    const after = rest.slice(parenEnd + 1); // ;param=…

    const items: string[] = [];
    const itemRe = /"([^"]+)"/g;
    let im: RegExpExecArray | null;
    while ((im = itemRe.exec(listInner)) !== null) {
      items.push(im[1]);
    }

    const params: Record<string, string> = {};
    const paramRe = /;([a-zA-Z0-9_-]+)=(?:"([^"]*)"|([0-9A-Za-z_.:/+#@-]+))/g;
    let pm: RegExpExecArray | null;
    while ((pm = paramRe.exec(after)) !== null) {
      params[pm[1].toLowerCase()] = pm[2] ?? pm[3] ?? "";
    }

    // rawParams is the value used on the @signature-params line (inner-list + params)
    const rawParams = rest.trim();

    out[label] = { items, params, rawParams };
  }

  return out;
}

/**
 * Build RFC 9421 signature base and verify with RSA (v1.5-SHA256 or PSS-SHA512).
 * Supports common ActivityPub covered components + Content-Digest (RFC 9530).
 */
export function verifyRfc9421HttpSignature(opts: {
  method: string;
  path: string;
  /** Host / authority (instance domain) */
  authority: string;
  headers: Record<string, string>;
  body: string;
  signature: Rfc9421Signature;
  publicKeyPem: string;
}): boolean {
  try {
    const { signature: sig } = opts;
    const now = Math.floor(Date.now() / 1000);
    if (sig.created != null && Math.abs(now - sig.created) > 5 * 60) {
      console.warn(
        `RFC9421 verify failed: created skew ${Math.abs(now - sig.created)}s`
      );
      return false;
    }
    if (sig.expires != null && now > sig.expires) {
      console.warn("RFC9421 verify failed: signature expired");
      return false;
    }

    // Verify Content-Digest / Digest if present in headers (body integrity)
    const contentDigest =
      opts.headers["content-digest"] || opts.headers["Content-Digest"];
    if (contentDigest) {
      if (!verifyContentDigestHeader(contentDigest, opts.body)) {
        console.warn("RFC9421 verify failed: content-digest mismatch");
        return false;
      }
    }

    const lines: string[] = [];
    for (const component of sig.components) {
      const value = resolveRfc9421Component(component, opts);
      if (value === null) {
        console.warn(`RFC9421 verify failed: missing component ${component}`);
        return false;
      }
      lines.push(`"${component}": ${value}`);
    }
    lines.push(`"@signature-params": ${sig.signatureParams}`);
    const base = lines.join("\n");

    const alg = (sig.algorithm || "rsa-v1_5-sha256").toLowerCase();
    const sigBuf = Buffer.from(sig.signatureBase64, "base64");

    if (alg === "rsa-v1_5-sha256" || alg === "rsa-sha256" || alg === "hs2019") {
      const verify = crypto.createVerify("RSA-SHA256");
      verify.update(base);
      verify.end();
      return verify.verify(opts.publicKeyPem, sigBuf);
    }

    if (alg === "rsa-pss-sha512") {
      return crypto.verify(
        "sha512",
        Buffer.from(base, "utf8"),
        {
          key: opts.publicKeyPem,
          padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
        },
        sigBuf
      );
    }

    console.warn(`RFC9421 verify failed: unsupported alg=${alg}`);
    return false;
  } catch (err) {
    console.warn(`RFC9421 verify error: ${String(err)}`);
    return false;
  }
}

function resolveRfc9421Component(
  component: string,
  opts: {
    method: string;
    path: string;
    authority: string;
    headers: Record<string, string>;
  }
): string | null {
  const lower = component.toLowerCase();
  switch (lower) {
    case "@method":
      return opts.method.toUpperCase();
    case "@authority":
      return opts.authority.toLowerCase();
    case "@path": {
      const q = opts.path.indexOf("?");
      const p = q >= 0 ? opts.path.slice(0, q) : opts.path;
      return p || "/";
    }
    case "@query": {
      const q = opts.path.indexOf("?");
      return q >= 0 ? opts.path.slice(q) : "?";
    }
    case "@target-uri":
      return `https://${opts.authority}${opts.path.startsWith("/") ? "" : "/"}${opts.path}`;
    case "@scheme":
      return "https";
    case "@request-target":
      // Not standard RFC 9421 derived, but some stacks still emit it
      return `${opts.method.toLowerCase()} ${opts.path}`;
    default: {
      // HTTP field component
      const headerVal =
        opts.headers[lower] ?? opts.headers[component] ?? opts.headers[component.toLowerCase()];
      if (headerVal === undefined || headerVal === null) return null;
      return String(headerVal).trim();
    }
  }
}

/** RFC 9530 Content-Digest: sha-256=:BASE64: (and sha-512). */
export function verifyContentDigestHeader(header: string, body: string): boolean {
  const re = /(sha-256|sha-512)=:([A-Za-z0-9+/=]*):/gi;
  let m: RegExpExecArray | null;
  let any = false;
  while ((m = re.exec(header)) !== null) {
    any = true;
    const algo = m[1].toLowerCase();
    const expected = m[2];
    const hash = crypto
      .createHash(algo === "sha-512" ? "sha512" : "sha256")
      .update(body)
      .digest("base64");
    if (hash !== expected) return false;
  }
  // Also accept legacy Digest: SHA-256=...
  if (!any && /^SHA-256=/i.test(header)) {
    return header === computeDigest(body);
  }
  return any;
}

/**
 * Pure HTTP Signature builder (Cavage draft). No DB access — used by signRequest
 * and unit tests.
 */
export function signHttpRequest(opts: SignHttpRequestOptions): SignedRequest {
  const method = opts.method.toUpperCase();
  const methodLower = method.toLowerCase();
  const hasBody =
    opts.body !== undefined && opts.body.length > 0 && method !== "GET" && method !== "HEAD";

  const urlObj = new URL(opts.url);
  const requestTarget = `${methodLower} ${urlObj.pathname}${urlObj.search}`;
  const date = opts.date ?? new Date().toUTCString();
  const host = urlObj.host;

  const signatureHeaders: SignatureHeaders = {
    "(request-target)": requestTarget,
    host,
    date,
  };

  const requestHeaders: Record<string, string> = {
    Host: host,
    Date: date,
  };

  const signedHeaderNames = ["(request-target)", "host", "date"];

  if (hasBody) {
    const contentType =
      opts.extraHeaders?.["Content-Type"] ||
      opts.extraHeaders?.["content-type"] ||
      "application/activity+json";
    const digest = computeDigest(opts.body!);
    signatureHeaders.digest = digest;
    signatureHeaders["content-type"] = contentType;
    requestHeaders.Digest = digest;
    requestHeaders["Content-Type"] = contentType;
    signedHeaderNames.push("digest", "content-type");
  }

  // Include Accept in the signed set when present (common for authorized-fetch GETs)
  const acceptHeader =
    opts.extraHeaders?.Accept ||
    opts.extraHeaders?.accept ||
    (method === "GET" ? ACTIVITYPUB_ACCEPT_HEADER : undefined);
  if (acceptHeader) {
    signatureHeaders.accept = acceptHeader;
    requestHeaders.Accept = acceptHeader;
    signedHeaderNames.push("accept");
  }

  if (opts.extraHeaders) {
    for (const [key, value] of Object.entries(opts.extraHeaders)) {
      const lower = key.toLowerCase();
      if (
        lower === "content-type" ||
        lower === "accept" ||
        lower === "host" ||
        lower === "date" ||
        lower === "digest"
      ) {
        continue;
      }
      requestHeaders[key] = value;
    }
  }

  const signatureString = signedHeaderNames
    .map((name) => {
      if (name === "(request-target)") {
        return `(request-target): ${requestTarget}`;
      }
      const value =
        name === "host"
          ? host
          : name === "date"
            ? date
            : name === "digest"
              ? signatureHeaders.digest
              : name === "content-type"
                ? signatureHeaders["content-type"]
                : name === "accept"
                  ? signatureHeaders.accept
                  : undefined;
      return `${name}: ${value}`;
    })
    .join("\n");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signatureString);
  sign.end();
  const signature = sign.sign(opts.privateKeyPem, "base64");

  requestHeaders.Signature = [
    `keyId="${opts.keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${signedHeaderNames.join(" ")}"`,
    `signature="${signature}"`,
  ].join(",");

  return {
    method,
    url: opts.url,
    headers: requestHeaders,
    body: hasBody ? opts.body : undefined,
  };
}

/**
 * Verify RSA-SHA256 over the Cavage signature base string built from
 * method, path, headers, and the Signature header parts.
 */
export function verifyHttpSignature(
  method: string,
  path: string,
  headers: Record<string, string>,
  signatureParts: ParsedSignatureHeader,
  publicKeyPem: string
): boolean {
  try {
    const signedHeaders = signatureParts.headers?.split(" ") || [];
    const signatureString = signedHeaders
      .map((headerName) => {
        if (headerName === "(request-target)") {
          return `(request-target): ${method.toLowerCase()} ${path}`;
        }
        const headerValue = headers[headerName.toLowerCase()] ?? headers[headerName];
        return `${headerName.toLowerCase()}: ${headerValue}`;
      })
      .join("\n");

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(signatureString);
    verify.end();

    return verify.verify(publicKeyPem, signatureParts.signature || "", "base64");
  } catch {
    return false;
  }
}

/**
 * Sign an HTTP request (Cavage draft). Returns all headers that were signed so
 * callers never re-generate Date/Digest after signing.
 */
export async function signRequest(options: SignRequestOptions): Promise<SignedRequest>;
/** @deprecated Prefer the options-object form that returns SignedRequest. */
export async function signRequest(
  method: string,
  url: string,
  body: string,
  userId: string
): Promise<string>;
export async function signRequest(
  methodOrOptions: string | SignRequestOptions,
  url?: string,
  body?: string,
  userId?: string
): Promise<SignedRequest | string> {
  const legacy = typeof methodOrOptions === "string";
  const opts: SignRequestOptions = legacy
    ? { method: methodOrOptions, url: url!, body: body ?? "", userId: userId! }
    : methodOrOptions;

  const db = getDb();
  const settings = await getInstanceSettings();

  const userKey = await db
    .selectFrom("user_keys")
    .select("private_key_pem")
    .where("user_id", "=", opts.userId)
    .executeTakeFirst();

  if (!userKey) {
    throw new Error("User key not found");
  }

  const userRow = await db
    .selectFrom("users")
    .select(["username"])
    .where("id", "=", opts.userId)
    .executeTakeFirst();

  if (!userRow) {
    throw new Error("User not found for signature");
  }

  const keyId = `https://${settings.instance_domain}/ap/users/${userRow.username}#main-key`;
  const result = signHttpRequest({
    method: opts.method,
    url: opts.url,
    body: opts.body,
    privateKeyPem: userKey.private_key_pem,
    keyId,
    extraHeaders: opts.extraHeaders,
  });

  if (legacy) {
    return result.headers.Signature;
  }
  return result;
}

const ACTOR_FETCH_TIMEOUT_MS = 12_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = ACTOR_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function signedFetch(
  url: string,
  options: {
    method?: string;
    body?: string;
    userId: string;
    headers?: Record<string, string>;
  }
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const signed = await signRequest({
    method,
    url,
    body: options.body,
    userId: options.userId,
    extraHeaders: options.headers,
  });

  return fetchWithTimeout(signed.url, {
    method: signed.method,
    headers: signed.headers,
    body: signed.body,
  });
}

export type RemoteActorDocument = {
  actorUrl: string;
  actor: {
    inbox?: string;
    endpoints?: { sharedInbox?: string };
    preferredUsername?: string;
    publicKey?: { publicKeyPem?: string; owner?: string; id?: string };
    [key: string]: unknown;
  };
};

/**
 * Fetch a remote actor document for key resolution / inbox delivery.
 *
 * Strategy (most of the fedi, including mastodon.social public actors):
 *   1. Unsigned GET first — many servers do NOT require HTTP signatures.
 *   2. If 401/403 and we have a signer, retry with signed GET (authorized-fetch /
 *      "secure mode" instances like some Mastodon configs and Threads).
 *
 * Previously we signed first and skipped unsigned on 401/403, which broke key
 * fetch against public Mastodon actors when our signed GET was rejected, and
 * could stall inbox verification for tens of seconds per Delete retry.
 */
export async function fetchRemoteActorDocument(
  actorUrl: string,
  opts?: { signerUserId?: string }
): Promise<RemoteActorDocument | null> {
  const candidates = buildRemoteActorCandidates(actorUrl);
  const signerUserId = opts?.signerUserId
    ? opts.signerUserId
    : await resolveKeyFetchSignerUserId();

  let lastStatus: number | null = null;
  let lastError: string | null = null;

  for (const candidate of candidates) {
    try {
      const unsigned = await fetchWithTimeout(candidate, {
        headers: { Accept: ACTIVITYPUB_ACCEPT_HEADER },
      });
      lastStatus = unsigned.status;

      if (unsigned.ok) {
        return {
          actorUrl: candidate,
          actor: (await unsigned.json()) as RemoteActorDocument["actor"],
        };
      }

      // Actor deleted/suspended — no public key; stop probing variants
      if (unsigned.status === 404 || unsigned.status === 410) {
        console.warn(
          `fetchRemoteActorDocument: actor gone status=${unsigned.status} url=${candidate}`
        );
        break;
      }

      // Authorized-fetch servers reject unsigned GETs — retry signed
      if (
        signerUserId &&
        (unsigned.status === 401 || unsigned.status === 403)
      ) {
        const signed = await signedFetch(candidate, {
          method: "GET",
          userId: signerUserId,
          headers: { Accept: ACTIVITYPUB_ACCEPT_HEADER },
        });
        lastStatus = signed.status;
        if (signed.ok) {
          return {
            actorUrl: candidate,
            actor: (await signed.json()) as RemoteActorDocument["actor"],
          };
        }
        if (signed.status === 404 || signed.status === 410) {
          console.warn(
            `fetchRemoteActorDocument: actor gone status=${signed.status} url=${candidate}`
          );
          break;
        }
        console.warn(
          `fetchRemoteActorDocument: signed GET failed status=${signed.status} url=${candidate}`
        );
        continue;
      }

      // Other 4xx: try signed once if available, then next candidate
      if (signerUserId && unsigned.status >= 400 && unsigned.status < 500) {
        const signed = await signedFetch(candidate, {
          method: "GET",
          userId: signerUserId,
          headers: { Accept: ACTIVITYPUB_ACCEPT_HEADER },
        });
        lastStatus = signed.status;
        if (signed.ok) {
          return {
            actorUrl: candidate,
            actor: (await signed.json()) as RemoteActorDocument["actor"],
          };
        }
        if (signed.status === 404 || signed.status === 410) {
          console.warn(
            `fetchRemoteActorDocument: actor gone status=${signed.status} url=${candidate}`
          );
          break;
        }
      }
    } catch (err) {
      // TLS / network / abort — one line, no stack dump
      lastError = formatFetchError(err);
      console.warn(`fetchRemoteActorDocument: network error url=${candidate} err=${lastError}`);
    }
  }

  console.warn(
    `fetchRemoteActorDocument failed for ${actorUrl} lastStatus=${lastStatus} lastError=${lastError ?? "-"} signed=${Boolean(signerUserId)}`
  );
  return null;
}

/**
 * Resolve inbox URLs from a remote actor (signed GET when possible).
 */
export async function fetchRemoteActorInbox(
  actorUrl: string,
  opts?: { signerUserId?: string }
): Promise<{
  inbox: string;
  sharedInbox?: string;
  preferredUsername?: string;
}> {
  const remote = await fetchRemoteActorDocument(actorUrl, opts);
  if (remote) {
    return {
      inbox: remote.actor.inbox || remote.actorUrl.replace(/\/$/, "") + "/inbox",
      sharedInbox: remote.actor.endpoints?.sharedInbox,
      preferredUsername: remote.actor.preferredUsername,
    };
  }
  return { inbox: actorUrl.replace(/\/$/, "") + "/inbox" };
}

async function getCachedRemoteKey(
  keyId: string,
  opts?: { allowStale?: boolean }
): Promise<{ public_key_pem: string; owner: string; stale: boolean } | null> {
  const db = getDb();
  const row = await db
    .selectFrom("remote_keys")
    .select(["public_key_pem", "owner", "fetched_at"])
    .where("key_id", "=", keyId)
    .executeTakeFirst();

  if (!row) return null;

  const ageMs = Date.now() - new Date(row.fetched_at as Date).getTime();
  const stale = ageMs > REMOTE_KEY_TTL_MS;
  if (stale && !opts?.allowStale) {
    return null;
  }

  return { public_key_pem: row.public_key_pem, owner: row.owner, stale };
}

async function cacheRemoteKey(
  keyId: string,
  owner: string,
  publicKeyPem: string
): Promise<void> {
  const db = getDb();
  await db
    .insertInto("remote_keys")
    .values({
      key_id: keyId,
      owner,
      public_key_pem: publicKeyPem,
      fetched_at: new Date(),
    })
    .onConflict((oc) =>
      oc.column("key_id").doUpdateSet({
        owner,
        public_key_pem: publicKeyPem,
        fetched_at: new Date(),
      })
    )
    .execute();
}

async function invalidateRemoteKey(keyId: string): Promise<void> {
  const db = getDb();
  await db.deleteFrom("remote_keys").where("key_id", "=", keyId).execute();
}

/**
 * Resolve a remote actor's public key: cache hit (within TTL) or signed GET.
 * Validates publicKey owner/id before caching.
 */
async function resolveRemotePublicKey(
  keyId: string,
  actorUrl: string,
  signerUserId?: string | null,
  opts?: { bypassCache?: boolean }
): Promise<string | null> {
  const { withSpan } = await import("./tracing");
  return withSpan(
    "ap.key_fetch",
    {
      "ap.key_id": keyId.slice(0, 200),
      "ap.bypass_cache": Boolean(opts?.bypassCache),
    },
    async () => {
      if (!opts?.bypassCache) {
        const cached = await getCachedRemoteKey(keyId);
        if (cached) {
          if (!actorUrlsEquivalent(cached.owner, actorUrl)) {
            console.warn(
              `Remote key cache owner mismatch for ${keyId}; invalidating`
            );
            await invalidateRemoteKey(keyId);
          } else {
            return cached.public_key_pem;
          }
        }
      }

      const remoteActor = await fetchRemoteActorDocument(actorUrl, {
        signerUserId: signerUserId || undefined,
      });
      if (!remoteActor) {
        // Actor often returns 410 after deletion while remotes still deliver signed
        // Delete activities. Use a previously cached key even if past TTL.
        const stale = await getCachedRemoteKey(keyId, { allowStale: true });
        if (stale && actorUrlsEquivalent(stale.owner, actorUrl)) {
          console.warn(
            `resolveRemotePublicKey: using stale cached key for ${keyId} (actor fetch failed)`
          );
          return stale.public_key_pem;
        }
        return null;
      }

      const { actor, actorUrl: resolvedActorUrl } = remoteActor;
      const publicKeyPem = actor.publicKey?.publicKeyPem;
      const publicKeyOwner = actor.publicKey?.owner;
      const publicKeyId = actor.publicKey?.id;

      if (!publicKeyPem) {
        console.warn("Sig verify failed: no publicKeyPem in actor");
        return null;
      }
      if (publicKeyOwner && !actorUrlsEquivalent(publicKeyOwner, actorUrl)) {
        console.warn(
          `Sig verify failed: publicKey.owner mismatch (owner=${publicKeyOwner}, expected=${actorUrl}, resolved=${resolvedActorUrl})`
        );
        return null;
      }
      if (publicKeyId && !keyIdsEquivalent(publicKeyId, keyId)) {
        console.warn(
          `Sig verify failed: publicKey.id mismatch (id=${publicKeyId}, expected=${keyId})`
        );
        return null;
      }

      const owner = publicKeyOwner || actorUrl;
      try {
        await cacheRemoteKey(keyId, owner, publicKeyPem);
      } catch (err) {
        console.warn("Failed to cache remote key:", err);
      }

      return publicKeyPem;
    }
  );
}

export async function verifySignature(
  method: string,
  path: string,
  headers: Record<string, string>,
  signatureHeader: string,
  body: string,
  options?: VerifySignatureOptions
): Promise<boolean> {
  const { withSpan } = await import("./tracing");
  return withSpan(
    "ap.verify_signature",
    { "http.method": method, "http.route": path.slice(0, 200) },
    async () => {
  try {
    // Behind a reverse proxy or tunnel, the Host header often gets
    // rewritten to the upstream address (e.g. localhost:8080). Use the
    // configured instance domain as the canonical host — it always
    // matches what remote servers signed against.
    const settings = await getInstanceSettings();
    const authority = settings.instance_domain.split(":")[0];
    headers = { ...headers, host: authority };

    const db = getDb();
    const digestHeader = headers["digest"] || headers["Digest"];
    if (digestHeader && !isRfc9421SignatureHeader(signatureHeader)) {
      // Cavage Digest: SHA-256=...
      const expectedDigest = computeDigest(body);
      if (digestHeader !== expectedDigest) {
        console.warn("Sig verify failed: digest mismatch");
        return false;
      }
    }

    const dateHeader = headers["date"] || headers["Date"];
    if (dateHeader && !isRfc9421SignatureHeader(signatureHeader)) {
      const parsed = new Date(dateHeader).getTime();
      if (Number.isNaN(parsed)) {
        console.warn("Sig verify failed: invalid date header");
        return false;
      }
      const diffMs = Math.abs(Date.now() - parsed);
      const maxSkewMs = 5 * 60 * 1000;
      if (diffMs > maxSkewMs) {
        console.warn(`Sig verify failed: date skew too large (${Math.round(diffMs / 1000)}s)`);
        return false;
      }
    }

    const signatureInput =
      headers["signature-input"] || headers["Signature-Input"] || "";

    // ── RFC 9421 path (Mastodon 4.4+ dual-sign / pure RFC deliveries) ──
    if (isRfc9421SignatureHeader(signatureHeader) || signatureInput) {
      const rfcSigs = parseRfc9421Signatures(signatureHeader, signatureInput);
      if (rfcSigs.length > 0) {
        for (const rfcSig of rfcSigs) {
          const ok = await verifyOneKeySignature({
            method,
            path,
            authority,
            headers,
            body,
            keyId: rfcSig.keyId,
            dateHeader,
            signatureToken: rfcSig.signatureBase64,
            settingsDomain: settings.instance_domain,
            db,
            keyFetchSignerUserId: options?.keyFetchSignerUserId,
            verifyWithKey: (publicKeyPem) =>
              verifyRfc9421HttpSignature({
                method,
                path,
                authority,
                headers,
                body,
                signature: rfcSig,
                publicKeyPem,
              }),
          });
          if (ok) return true;
        }
        // Fall through to Cavage if Signature also carries draft form
      } else if (isRfc9421SignatureHeader(signatureHeader)) {
        console.warn(
          `Sig verify failed: RFC9421 Signature without usable Signature-Input (sample=${signatureHeader.slice(0, 80)})`
        );
        return false;
      }
    }

    // ── Cavage draft path (classic ActivityPub) ──
    const signatureParts = parseSignatureHeader(signatureHeader) as Record<string, string>;
    const keyId = signatureParts.keyId;
    if (!keyId) {
      console.warn(
        `Sig verify failed: missing keyId (header sample=${signatureHeader.slice(0, 120)})`
      );
      return false;
    }

    return verifyOneKeySignature({
      method,
      path,
      authority,
      headers,
      body,
      keyId,
      dateHeader,
      signatureToken: signatureParts.signature || "",
      settingsDomain: settings.instance_domain,
      db,
      keyFetchSignerUserId: options?.keyFetchSignerUserId,
      verifyWithKey: (publicKeyPem) =>
        verifySignatureWithKey(method, path, headers, signatureParts, publicKeyPem),
    });
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
    }
  );
}

async function verifyOneKeySignature(opts: {
  method: string;
  path: string;
  authority: string;
  headers: Record<string, string>;
  body: string;
  keyId: string;
  dateHeader?: string;
  signatureToken: string;
  settingsDomain: string;
  db: ReturnType<typeof getDb>;
  keyFetchSignerUserId?: string;
  verifyWithKey: (publicKeyPem: string) => boolean;
}): Promise<boolean> {
  const { keyId, db, dateHeader, signatureToken } = opts;
  console.warn(`Verifying signature for keyId: ${keyId}`);

  const replayKey = `${signatureToken}:${dateHeader || ""}`;
  const replay = await db
    .selectFrom("replay_cache")
    .select("created_at")
    .where("key", "=", replayKey)
    .executeTakeFirst();
  const now = Date.now();
  if (replay && now - new Date(replay.created_at as any).getTime() < SIGNATURE_TTL_MS) {
    console.warn(`Sig verify failed: replay cache hit for keyId=${keyId}`);
    return false;
  }
  await db
    .insertInto("replay_cache")
    .values({ key: replayKey })
    .onConflict((oc) => oc.column("key").doNothing())
    .execute();

  const actorUrl = actorUrlFromKeyId(keyId);
  const actorId = getActorIdFromUrl(actorUrl);

  let localUser: { id: string } | undefined;
  try {
    const actorHost = normalizeActorHostname(new URL(actorUrl).hostname);
    const instanceHost = normalizeActorHostname(opts.settingsDomain.split(":")[0]);
    if (actorHost === instanceHost) {
      localUser = await db
        .selectFrom("users")
        .select("id")
        .where("username", "=", actorId || "")
        .executeTakeFirst();
    }
  } catch {
    /* non-URL keyId */
  }

  if (localUser) {
    const userKey = await db
      .selectFrom("user_keys")
      .select("public_key_pem")
      .where("user_id", "=", localUser.id)
      .executeTakeFirst();

    if (!userKey) {
      console.warn("Sig verify failed: local user key not found");
      return false;
    }
    return opts.verifyWithKey(userKey.public_key_pem);
  }

  if (!actorUrl.startsWith("https://")) {
    console.warn("Sig verify failed: non-HTTPS actor URL");
    return false;
  }

  const signerUserId = await resolveKeyFetchSignerUserId(opts.keyFetchSignerUserId);
  let publicKeyPem = await resolveRemotePublicKey(keyId, actorUrl, signerUserId);
  if (!publicKeyPem) {
    console.warn("Sig verify failed: remote actor fetch failed for all candidates");
    return false;
  }

  let ok = opts.verifyWithKey(publicKeyPem);
  if (!ok) {
    console.warn(`RSA verify failed for ${keyId}; invalidating cache and re-fetching`);
    await invalidateRemoteKey(keyId);
    publicKeyPem = await resolveRemotePublicKey(keyId, actorUrl, signerUserId, {
      bypassCache: true,
    });
    if (!publicKeyPem) {
      console.warn("Sig verify failed: remote key re-fetch after invalidate failed");
      return false;
    }
    ok = opts.verifyWithKey(publicKeyPem);
  }
  return ok;
}

function verifySignatureWithKey(
  method: string,
  path: string,
  headers: Record<string, string>,
  signatureParts: Record<string, string>,
  publicKeyPem: string
): boolean {
  console.warn(`[SIG DEBUG] Signed headers: ${signatureParts.headers || ""}`);
  const result = verifyHttpSignature(method, path, headers, signatureParts, publicKeyPem);
  if (!result) {
    console.warn("Sig verify failed: RSA-SHA256 verification failed");
  }
  return result;
}
