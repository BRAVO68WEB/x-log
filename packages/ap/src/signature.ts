import crypto from "crypto";
import { getDb, getInstanceSettings } from "@xlog/db";
const SIGNATURE_TTL_MS = 15 * 60 * 1000;

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
    const actorId = actorUrl.split("/").pop();

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
      const resp = await fetch(actorUrl, {
        headers: {
          Accept: "application/activity+json",
        },
      });
      if (!resp.ok) {
        console.warn(`Sig verify failed: remote actor fetch failed (status=${resp.status})`);
        return false;
      }
      const actor = (await resp.json()) as { publicKey?: { publicKeyPem?: string; owner?: string; id?: string } };
      const publicKeyPem = actor.publicKey?.publicKeyPem;
      const publicKeyOwner = actor.publicKey?.owner;
      const publicKeyId = actor.publicKey?.id;
      if (!publicKeyPem) {
        console.warn("Sig verify failed: no publicKeyPem in actor");
        return false;
      }
      if (publicKeyOwner && publicKeyOwner !== actorUrl) {
        console.warn(`Sig verify failed: publicKey.owner mismatch (owner=${publicKeyOwner}, expected=${actorUrl})`);
        return false;
      }
      if (publicKeyId && publicKeyId !== keyId) {
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
