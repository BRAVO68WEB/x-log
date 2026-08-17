import { describe, expect, test } from "bun:test";
import { createHash, createSign, generateKeyPairSync } from "crypto";
import {
  computeDigest,
  createSignatureString,
  extractSignatureKeyId,
  isRfc9421SignatureHeader,
  parseRfc9421Signatures,
  parseSignatureHeader,
  signHttpRequest,
  verifyContentDigestHeader,
  verifyHttpSignature,
  verifyRfc9421HttpSignature,
} from "./signature";

function generateTestKeys() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

const KEY_ID = "https://example.com/ap/users/alice#main-key";
const FIXED_DATE = "Wed, 01 Jan 2025 12:00:00 GMT";

describe("computeDigest", () => {
  test("SHA-256 base64 of body", () => {
    const body = '{"type":"Follow"}';
    const digest = computeDigest(body);
    expect(digest.startsWith("SHA-256=")).toBe(true);
    expect(digest).toBe(computeDigest(body));
    expect(computeDigest(body)).not.toBe(computeDigest(body + " "));
  });
});

describe("createSignatureString", () => {
  test("joins headers as name: value lines", () => {
    const s = createSignatureString({
      "(request-target)": "post /inbox",
      host: "remote.example",
      date: FIXED_DATE,
    });
    expect(s).toBe(
      `(request-target): post /inbox\nhost: remote.example\ndate: ${FIXED_DATE}`
    );
  });
});

describe("signHttpRequest POST", () => {
  test("includes digest and content-type; Date matches signed value", () => {
    const { privateKey } = generateTestKeys();
    const body = JSON.stringify({ type: "Create", actor: "https://example.com/ap/users/alice" });
    const url = "https://remote.social/users/bob/inbox";

    const signed = signHttpRequest({
      method: "POST",
      url,
      body,
      privateKeyPem: privateKey,
      keyId: KEY_ID,
      date: FIXED_DATE,
    });

    expect(signed.method).toBe("POST");
    expect(signed.body).toBe(body);
    expect(signed.headers.Date).toBe(FIXED_DATE);
    expect(signed.headers.Host).toBe("remote.social");
    expect(signed.headers.Digest).toBe(computeDigest(body));
    expect(signed.headers["Content-Type"]).toBe("application/activity+json");
    expect(signed.headers.Signature).toContain(`keyId="${KEY_ID}"`);
    expect(signed.headers.Signature).toContain("algorithm=\"rsa-sha256\"");
    expect(signed.headers.Signature).toContain(
      'headers="(request-target) host date digest content-type"'
    );
    expect(signed.headers.Signature).toMatch(/signature="[A-Za-z0-9+/=]+"/);
    // GET-only Accept must not appear on POST unless requested
    expect(signed.headers.Accept).toBeUndefined();
  });

  test("round-trips with verifyHttpSignature", () => {
    const { privateKey, publicKey } = generateTestKeys();
    const body = '{"@context":"https://www.w3.org/ns/activitystreams","type":"Accept"}';
    const url = "https://remote.social/inbox";

    const signed = signHttpRequest({
      method: "POST",
      url,
      body,
      privateKeyPem: privateKey,
      keyId: KEY_ID,
      date: FIXED_DATE,
    });

    const parts = parseSignatureHeader(signed.headers.Signature);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(signed.headers)) {
      headers[k.toLowerCase()] = v;
    }

    const ok = verifyHttpSignature("POST", "/inbox", headers, parts, publicKey);
    expect(ok).toBe(true);
  });

  test("fails verify when body digest would mismatch (tampered Digest header)", () => {
    const { privateKey, publicKey } = generateTestKeys();
    const body = '{"type":"Like"}';
    const signed = signHttpRequest({
      method: "POST",
      url: "https://remote.social/inbox",
      body,
      privateKeyPem: privateKey,
      keyId: KEY_ID,
      date: FIXED_DATE,
    });

    const parts = parseSignatureHeader(signed.headers.Signature);
    const headers: Record<string, string> = {
      host: signed.headers.Host,
      date: signed.headers.Date,
      digest: "SHA-256=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      "content-type": signed.headers["Content-Type"],
    };

    const ok = verifyHttpSignature("POST", "/inbox", headers, parts, publicKey);
    expect(ok).toBe(false);
  });
});

describe("signHttpRequest GET (authorized fetch)", () => {
  test("has no digest; signs accept; Date is stable", () => {
    const { privateKey } = generateTestKeys();
    const url = "https://remote.social/users/bob";

    const signed = signHttpRequest({
      method: "GET",
      url,
      privateKeyPem: privateKey,
      keyId: KEY_ID,
      date: FIXED_DATE,
    });

    expect(signed.method).toBe("GET");
    expect(signed.body).toBeUndefined();
    expect(signed.headers.Date).toBe(FIXED_DATE);
    expect(signed.headers.Digest).toBeUndefined();
    expect(signed.headers["Content-Type"]).toBeUndefined();
    expect(signed.headers.Accept).toContain("application/activity+json");
    expect(signed.headers.Signature).toContain(
      'headers="(request-target) host date accept"'
    );
  });

  test("round-trips GET signature verification", () => {
    const { privateKey, publicKey } = generateTestKeys();
    const url = "https://remote.social/users/bob?page=1";

    const signed = signHttpRequest({
      method: "GET",
      url,
      privateKeyPem: privateKey,
      keyId: KEY_ID,
      date: FIXED_DATE,
    });

    const parts = parseSignatureHeader(signed.headers.Signature);
    const headers: Record<string, string> = {
      host: signed.headers.Host,
      date: signed.headers.Date,
      accept: signed.headers.Accept,
    };

    const ok = verifyHttpSignature("GET", "/users/bob?page=1", headers, parts, publicKey);
    expect(ok).toBe(true);
  });

  test("includes query string in request-target", () => {
    const { privateKey, publicKey } = generateTestKeys();
    const signed = signHttpRequest({
      method: "GET",
      url: "https://remote.social/users/bob/outbox?page=2",
      privateKeyPem: privateKey,
      keyId: KEY_ID,
      date: FIXED_DATE,
    });

    const parts = parseSignatureHeader(signed.headers.Signature);
    const headers: Record<string, string> = {
      host: "remote.social",
      date: FIXED_DATE,
      accept: signed.headers.Accept,
    };

    expect(
      verifyHttpSignature("GET", "/users/bob/outbox?page=2", headers, parts, publicKey)
    ).toBe(true);
    expect(
      verifyHttpSignature("GET", "/users/bob/outbox", headers, parts, publicKey)
    ).toBe(false);
  });
});

describe("parseSignatureHeader", () => {
  test("extracts keyId algorithm headers signature", () => {
    const header =
      'keyId="https://example.com/ap/users/alice#main-key",algorithm="rsa-sha256",headers="(request-target) host date",signature="abc+DEF/123="';
    const parts = parseSignatureHeader(header);
    expect(parts.keyId).toBe("https://example.com/ap/users/alice#main-key");
    expect(parts.algorithm).toBe("rsa-sha256");
    expect(parts.headers).toBe("(request-target) host date");
    expect(parts.signature).toBe("abc+DEF/123=");
  });

  test("accepts single-quoted values", () => {
    const header =
      "keyId='https://example.com/ap/users/alice#main-key',algorithm='rsa-sha256',headers='(request-target) host date',signature='abc'";
    const parts = parseSignatureHeader(header);
    expect(parts.keyId).toBe("https://example.com/ap/users/alice#main-key");
    expect(parts.algorithm).toBe("rsa-sha256");
  });
});

describe("RFC 9421 HTTP Message Signatures", () => {
  test("detects sig1 dictionary form", () => {
    expect(isRfc9421SignatureHeader("sig1=:abc123=:")).toBe(true);
    expect(
      isRfc9421SignatureHeader(
        'keyId="https://example.com#main-key",algorithm="rsa-sha256",headers="(request-target) host date",signature="abc"'
      )
    ).toBe(false);
  });

  test("parses Signature-Input + Signature and extracts keyId", () => {
    const keyId = "https://mastodon.social/users/alice#main-key";
    const input = `sig1=("@method" "@authority" "@path" "date");created=1700000000;keyid="${keyId}"`;
    const sig = `sig1=:dGVzdA==:`;
    const parsed = parseRfc9421Signatures(sig, input);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].keyId).toBe(keyId);
    expect(parsed[0].components).toEqual(["@method", "@authority", "@path", "date"]);
    expect(extractSignatureKeyId(sig, input)).toBe(keyId);
  });

  test("round-trips rsa-v1_5-sha256 verify", () => {
    const { privateKey, publicKey } = generateTestKeys();
    const method = "POST";
    const path = "/ap/inbox";
    const authority = "xlog.example";
    const created = Math.floor(Date.now() / 1000);
    const date = new Date(created * 1000).toUTCString();
    const body = '{"type":"Delete"}';
    const contentDigest = `sha-256=:${createHash("sha256").update(body).digest("base64")}:`;

    const components = ["@method", "@authority", "@path", "content-digest", "date"];
    const keyId = "https://remote.example/users/bob#main-key";
    const signatureParams = `("@method" "@authority" "@path" "content-digest" "date");alg="rsa-v1_5-sha256";created=${created};keyid="${keyId}"`;

    const base = [
      `"@method": ${method}`,
      `"@authority": ${authority}`,
      `"@path": ${path}`,
      `"content-digest": ${contentDigest}`,
      `"date": ${date}`,
      `"@signature-params": ${signatureParams}`,
    ].join("\n");

    const sign = createSign("RSA-SHA256");
    sign.update(base);
    sign.end();
    const signatureBase64 = sign.sign(privateKey, "base64");

    const ok = verifyRfc9421HttpSignature({
      method,
      path,
      authority,
      headers: {
        date,
        "content-digest": contentDigest,
      },
      body,
      signature: {
        label: "sig1",
        components,
        signatureParams,
        keyId,
        algorithm: "rsa-v1_5-sha256",
        created,
        signatureBase64,
      },
      publicKeyPem: publicKey,
    });
    expect(ok).toBe(true);
  });

  test("content-digest verifies body", () => {
    const body = '{"a":1}';
    const dig = `sha-256=:${createHash("sha256").update(body).digest("base64")}:`;
    expect(verifyContentDigestHeader(dig, body)).toBe(true);
    expect(verifyContentDigestHeader(dig, body + "x")).toBe(false);
    expect(verifyContentDigestHeader(computeDigest(body), body)).toBe(true);
  });
});