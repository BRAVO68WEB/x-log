import { encryptSecret, getEnv, parseEncryptionKey } from "@xlog/config";

/** Encrypt a secret when DATA_ENCRYPTION_KEY is configured. Dev may store plaintext. */
export function sealSecret(plaintext: string): string {
  const key = parseEncryptionKey(getEnv().DATA_ENCRYPTION_KEY);
  if (!key) return plaintext;
  return encryptSecret(plaintext, key);
}
