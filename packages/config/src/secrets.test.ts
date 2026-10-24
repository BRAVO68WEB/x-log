import { describe, expect, test } from "bun:test";
import { decryptSecret, encryptSecret, parseEncryptionKey } from "./secrets";

describe("secrets", () => {
  test("round-trips AES-256-GCM and leaves legacy plaintext", () => {
    const key = Buffer.alloc(32, 7);
    const enc = encryptSecret("pem-data", key);
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(decryptSecret(enc, key)).toBe("pem-data");
    expect(encryptSecret(enc, key)).toBe(enc);
    expect(decryptSecret("legacy-plaintext", null)).toBe("legacy-plaintext");
  });

  test("parses a 32-byte base64 key", () => {
    const raw = Buffer.alloc(32, 3).toString("base64");
    expect(parseEncryptionKey(raw)?.length).toBe(32);
    expect(parseEncryptionKey(undefined)).toBeNull();
    expect(() => parseEncryptionKey(Buffer.alloc(8).toString("base64"))).toThrow(/32 bytes/);
  });
});
