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

    const hostVariants = new Set<string>([url.hostname]);
    if (url.hostname.startsWith("www.")) {
      hostVariants.add(url.hostname.slice(4));
    } else {
      hostVariants.add(`www.${url.hostname}`);
    }

    for (const hostname of hostVariants) {
      const variant = new URL(withoutSlash.toString());
      variant.hostname = hostname;
      add(variant.toString());

      const variantWithSlash = new URL(variant.toString());
      if (!variantWithSlash.pathname.endsWith("/")) {
        variantWithSlash.pathname = `${variantWithSlash.pathname}/`;
        add(variantWithSlash.toString());
      }
    }
  } catch {
    add(actorUrl);
  }

  return [...candidates];
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

  const method = opts.method.toUpperCase();
  const methodLower = method.toLowerCase();
  const hasBody = opts.body !== undefined && opts.body.length > 0 && method !== "GET" && method !== "HEAD";

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

  const urlObj = new URL(opts.url);
  const requestTarget = `${methodLower} ${urlObj.pathname}${urlObj.search}`;
  const date = new Date().toUTCString();
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
    opts.extraHeaders?.Accept || opts.extraHeaders?.accept || (method === "GET" ? ACTIVITYPUB_ACCEPT_HEADER : undefined);
  if (acceptHeader) {
    signatureHeaders.accept = acceptHeader;
    requestHeaders.Accept = acceptHeader;
    signedHeaderNames.push("accept");
  }

  // Pass through any extra headers that were not already handled
  if (opts.extraHeaders) {
    for (const [key, value] of Object.entries(opts.extraHeaders)) {
      const lower = key.toLowerCase();
      if (lower === "content-type" || lower === "accept" || lower === "host" || lower === "date" || lower === "digest") {
        continue;
      }
      requestHeaders[key] = value;
    }
  }

  // Build signature string in the same order as headers= list
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
  const signature = sign.sign(userKey.private_key_pem, "base64");

  const keyId = `https://${settings.instance_domain}/ap/users/${userRow.username}#main-key`;
  requestHeaders.Signature = [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="${signedHeaderNames.join(" ")}"`,
    `signature="${signature}"`,
  ].join(",");

  const result: SignedRequest = {
    method,
    url: opts.url,
    headers: requestHeaders,
    body: hasBody ? opts.body : undefined,
  };

  if (legacy) {
    return result.headers.Signature;
  }
  return result;
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

  return fetch(signed.url, {
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
 * Fetch a remote actor document. Uses a signed GET when signerUserId is set
 * (required for Mastodon authorized fetch / secure mode).
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

  for (const candidate of candidates) {
    try {
      let resp: Response;
      if (signerUserId) {
        resp = await signedFetch(candidate, {
          method: "GET",
          userId: signerUserId,
          headers: { Accept: ACTIVITYPUB_ACCEPT_HEADER },
        });
      } else {
        resp = await fetch(candidate, {
          headers: { Accept: ACTIVITYPUB_ACCEPT_HEADER },
        });
      }

      lastStatus = resp.status;
      if (resp.ok) {
        return {
          actorUrl: candidate,
          actor: (await resp.json()) as RemoteActorDocument["actor"],
        };
      }

      // Signed request rejected — try unsigned once for non-enforcing servers
      // that might mishandle signatures on GET (rare); skip if already unsigned.
      if (signerUserId && (resp.status === 401 || resp.status === 403)) {
        // authorized fetch is expected to reject unsigned; do not fall back
        continue;
      }
      if (signerUserId && resp.status >= 400) {
        const unsigned = await fetch(candidate, {
          headers: { Accept: ACTIVITYPUB_ACCEPT_HEADER },
        });
        lastStatus = unsigned.status;
        if (unsigned.ok) {
          return {
            actorUrl: candidate,
            actor: (await unsigned.json()) as RemoteActorDocument["actor"],
          };
        }
      }
    } catch (err) {
      console.error(`Failed to fetch remote actor ${candidate}:`, err);
    }
  }

  console.warn(
    `fetchRemoteActorDocument failed for ${actorUrl} lastStatus=${lastStatus} signed=${Boolean(signerUserId)}`
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
  keyId: string
): Promise<{ public_key_pem: string; owner: string } | null> {
  const db = getDb();
  const row = await db
    .selectFrom("remote_keys")
    .select(["public_key_pem", "owner", "fetched_at"])
    .where("key_id", "=", keyId)
    .executeTakeFirst();

  if (!row) return null;

  const ageMs = Date.now() - new Date(row.fetched_at as Date).getTime();
  if (ageMs > REMOTE_KEY_TTL_MS) {
    return null;
  }

  return { public_key_pem: row.public_key_pem, owner: row.owner };
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

export async function verifySignature(
  method: string,
  path: string,
  headers: Record<string, string>,
  signatureHeader: string,
  body: string,
  options?: VerifySignatureOptions
): Promise<boolean> {
  try {
    // Behind a reverse proxy or tunnel, the Host header often gets
    // rewritten to the upstream address (e.g. localhost:8080). Use the
    // configured instance domain as the canonical host — it always
    // matches what remote servers signed against.
    const settings = await getInstanceSettings();
    headers = { ...headers, host: settings.instance_domain };

    const db = getDb();
    const digestHeader = headers["digest"] || headers["Digest"];
    if (digestHeader) {
      const expectedDigest = computeDigest(body);
      if (digestHeader !== expectedDigest) {
        console.warn("Sig verify failed: digest mismatch");
        return false;
      }
    }

    const dateHeader = headers["date"] || headers["Date"];
    if (dateHeader) {
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

    // Parse signature header
    const signatureParts: Record<string, string> = {};
    signatureHeader.split(",").forEach((part) => {
      const match = part.trim().match(/(\w+)="([^"]+)"/);
      if (match) {
        signatureParts[match[1]] = match[2];
      }
    });

    const keyId = signatureParts.keyId;
    if (!keyId) {
      console.warn("Sig verify failed: missing keyId");
      return false;
    }

    console.warn(`Verifying signature for keyId: ${keyId}`);

    const replayKey = `${signatureParts.signature || ""}:${dateHeader || ""}`;
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

    // Local actor: only treat as local when host matches instance domain
    let localUser: { id: string } | undefined;
    try {
      const actorHost = normalizeActorHostname(new URL(actorUrl).hostname);
      const instanceHost = normalizeActorHostname(settings.instance_domain.split(":")[0]);
      if (actorHost === instanceHost) {
        localUser = await db
          .selectFrom("users")
          .select("id")
          .where("username", "=", actorId || "")
          .executeTakeFirst();
      }
    } catch {
      // non-URL keyId — fall through to remote path
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

      return verifySignatureWithKey(method, path, headers, signatureParts, userKey.public_key_pem);
    }

    if (!actorUrl.startsWith("https://")) {
      console.warn("Sig verify failed: non-HTTPS actor URL");
      return false;
    }

    const signerUserId = await resolveKeyFetchSignerUserId(options?.keyFetchSignerUserId);
    let publicKeyPem = await resolveRemotePublicKey(keyId, actorUrl, signerUserId);
    if (!publicKeyPem) {
      console.warn("Sig verify failed: remote actor fetch failed for all candidates");
      return false;
    }

    let ok = verifySignatureWithKey(method, path, headers, signatureParts, publicKeyPem);
    if (!ok) {
      // Stale or rotated key: invalidate cache and re-fetch once
      console.warn(`RSA verify failed for ${keyId}; invalidating cache and re-fetching`);
      await invalidateRemoteKey(keyId);
      publicKeyPem = await resolveRemotePublicKey(keyId, actorUrl, signerUserId, {
        bypassCache: true,
      });
      if (!publicKeyPem) {
        console.warn("Sig verify failed: remote key re-fetch after invalidate failed");
        return false;
      }
      ok = verifySignatureWithKey(method, path, headers, signatureParts, publicKeyPem);
    }
    return ok;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

function verifySignatureWithKey(
  method: string,
  path: string,
  headers: Record<string, string>,
  signatureParts: Record<string, string>,
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

    console.warn(`[SIG DEBUG] Signed headers: ${signedHeaders.join(", ")}`);
    console.warn(`[SIG DEBUG] Signature string:\n${signatureString}`);

    const verify = crypto.createVerify("RSA-SHA256");
    verify.update(signatureString);
    verify.end();

    const result = verify.verify(publicKeyPem, signatureParts.signature || "", "base64");
    if (!result) {
      console.warn("Sig verify failed: RSA-SHA256 verification failed");
    }
    return result;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}
