import crypto from "crypto";
import { getDb, getInstanceSettings } from "@xlog/db";
const SIGNATURE_TTL_MS = 15 * 60 * 1000;
const ACTIVITYPUB_ACCEPT_HEADER =
  'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

export interface SignatureHeaders {
  "(request-target)": string;
  host: string;
  date: string;
  digest?: string;
  "content-type"?: string;
}

export function createSignatureString(headers: SignatureHeaders): string {
  return Object.entries(headers)
    .map(([key, value]) => `${key.toLowerCase()}: ${value}`)
    .join("\n");
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

async function fetchRemoteActorDocument(actorUrl: string) {
  const candidates = buildRemoteActorCandidates(actorUrl);

  for (const candidate of candidates) {
    const resp = await fetch(candidate, {
      headers: {
        Accept: ACTIVITYPUB_ACCEPT_HEADER,
      },
    });

    if (resp.ok) {
      return {
        actorUrl: candidate,
        actor: (await resp.json()) as {
          publicKey?: { publicKeyPem?: string; owner?: string; id?: string };
        },
      };
    }
  }

  return null;
}

export async function signRequest(
  method: string,
  url: string,
  body: string,
  userId: string
): Promise<string> {
  const db = getDb();
  const settings = await getInstanceSettings();

  const userKey = await db
    .selectFrom("user_keys")
    .select("private_key_pem")
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (!userKey) {
    throw new Error("User key not found");
  }

  const urlObj = new URL(url);
  const requestTarget = `${method.toLowerCase()} ${urlObj.pathname}${urlObj.search}`;
  const date = new Date().toUTCString();
  const digest = `SHA-256=${crypto.createHash("sha256").update(body).digest("base64")}`;

  const headers: SignatureHeaders = {
    "(request-target)": requestTarget,
    host: urlObj.host,
    date,
    digest,
    "content-type": "application/activity+json",
  };

  const signatureString = createSignatureString(headers);
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(signatureString);
  sign.end();
  const signature = sign.sign(userKey.private_key_pem, "base64");

  const userRow = await db
    .selectFrom("users")
    .select(["username"])
    .where("id", "=", userId)
    .executeTakeFirst();

  if (!userRow) {
    throw new Error("User not found for signature");
  }

  const keyId = `https://${settings.instance_domain}/ap/users/${userRow.username}#main-key`;

  const signatureHeader = [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="(request-target) host date digest content-type"`,
    `signature="${signature}"`,
  ].join(",");

  return signatureHeader;
}

export async function verifySignature(
  method: string,
  path: string,
  headers: Record<string, string>,
  signatureHeader: string,
  body: string
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
      const expectedDigest = `SHA-256=${crypto
        .createHash("sha256")
        .update(body)
        .digest("base64")}`;
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

    // Extract actor URL from keyId
    const actorUrl = keyId.replace(/#main-key$/, "");
    const actorId = getActorIdFromUrl(actorUrl);

    // Fetch public key from database or remote
    // db already initialized above
    const user = await db
      .selectFrom("users")
      .select("id")
      .where("username", "=", actorId || "")
      .executeTakeFirst();

    if (user) {
      // Local user
      const userKey = await db
        .selectFrom("user_keys")
        .select("public_key_pem")
        .where("user_id", "=", user.id)
        .executeTakeFirst();

      if (!userKey) {
        console.warn("Sig verify failed: local user key not found");
        return false;
      }

      return verifySignatureWithKey(
        method,
        path,
        headers,
        signatureParts,
        body,
        userKey.public_key_pem
      );
    } else {
      if (!actorUrl.startsWith("https://")) {
        console.warn("Sig verify failed: non-HTTPS actor URL");
        return false;
      }
      const remoteActor = await fetchRemoteActorDocument(actorUrl);
      if (!remoteActor) {
        console.warn("Sig verify failed: remote actor fetch failed for all candidates");
        return false;
      }
      const { actor, actorUrl: resolvedActorUrl } = remoteActor;
      const publicKeyPem = actor.publicKey?.publicKeyPem;
      const publicKeyOwner = actor.publicKey?.owner;
      const publicKeyId = actor.publicKey?.id;
      if (!publicKeyPem) {
        console.warn("Sig verify failed: no publicKeyPem in actor");
        return false;
      }
      if (publicKeyOwner && !actorUrlsEquivalent(publicKeyOwner, actorUrl)) {
        console.warn(
          `Sig verify failed: publicKey.owner mismatch (owner=${publicKeyOwner}, expected=${actorUrl}, resolved=${resolvedActorUrl})`
        );
        return false;
      }
      if (publicKeyId && !keyIdsEquivalent(publicKeyId, keyId)) {
        console.warn(`Sig verify failed: publicKey.id mismatch (id=${publicKeyId}, expected=${keyId})`);
        return false;
      }
      return verifySignatureWithKey(
        method,
        path,
        headers,
        signatureParts,
        body,
        publicKeyPem
      );
    }
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
  body: string,
  publicKeyPem: string
): boolean {
  try {
    const signedHeaders = signatureParts.headers?.split(" ") || [];
    const signatureString = signedHeaders
      .map((headerName) => {
        if (headerName === "(request-target)") {
          return `(request-target): ${method.toLowerCase()} ${path}`;
        }
        const headerValue = headers[headerName.toLowerCase()];
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
