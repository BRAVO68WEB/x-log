import crypto from "crypto";

const PREFIX = "enc:v1:";

/** 32-byte AES key from standard base64. Returns null when unset. */
export function parseEncryptionKey(raw: string | undefined | null): Buffer | null {
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  }
  return buf;
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  if (plaintext.startsWith(PREFIX)) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64url");
}

/**
 * Decrypt `enc:v1:` values. Legacy plaintext is returned unchanged so a
 * missing key does not break rows that have not been migrated yet.
 */
export function decryptSecret(value: string, key: Buffer | null): string {
  if (!value.startsWith(PREFIX)) return value;
  if (!key) {
    throw new Error("DATA_ENCRYPTION_KEY is required to decrypt stored secrets");
  }
  const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
  if (raw.length < 29) {
    throw new Error("Stored secret is truncated");
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptionPrefix(): string {
  return PREFIX;
}
