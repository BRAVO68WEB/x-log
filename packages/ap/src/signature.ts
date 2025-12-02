import crypto from "crypto";
import { getDb, getInstanceSettings } from "@xlog/db";

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

  const keyId = `https://${settings.instance_domain}/ap/users/${userId}#main-key`;

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
      return false;
    }

    // Extract actor URL from keyId
    const actorUrl = keyId.replace(/#main-key$/, "");
    const actorId = actorUrl.split("/").pop();

    // Fetch public key from database or remote
    const db = getDb();
    const user = await db
      .selectFrom("users")
      .select("id")
      .where("id", "=", actorId || "")
      .executeTakeFirst();

    if (user) {
      // Local user
      const userKey = await db
        .selectFrom("user_keys")
        .select("public_key_pem")
        .where("user_id", "=", user.id)
        .executeTakeFirst();

      if (!userKey) {
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
      // Remote user - fetch actor and public key
      // TODO: Implement remote key fetching
      return false;
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

    return verify.verify(publicKeyPem, signatureParts.signature || "", "base64");
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

