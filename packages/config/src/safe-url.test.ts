import { describe, expect, test } from "bun:test";
import { assertPublicUrl, isBlockedIp, safeFetch } from "./safe-url";

describe("isBlockedIp", () => {
  test("blocks loopback, metadata, private, and mapped addresses", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("10.1.2.3")).toBe(true);
    expect(isBlockedIp("169.254.169.254")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  test("rejects localhost, numeric hosts, credentials, and ambiguous IPs", async () => {
    await expect(assertPublicUrl("http://localhost/")).rejects.toThrow(/Blocked host/);
    await expect(assertPublicUrl("http://metadata.google.internal/")).rejects.toThrow(/Blocked host/);
    await expect(assertPublicUrl("http://2130706433/")).rejects.toThrow(/Blocked IP|Numeric host/);
    await expect(assertPublicUrl("http://127.1/")).rejects.toThrow(/Blocked IP|Ambiguous/);
    await expect(assertPublicUrl("http://127.0.0.01/")).rejects.toThrow(/Blocked IP|Ambiguous/);
    await expect(assertPublicUrl("http://169.254.169.254/latest")).rejects.toThrow(/Blocked IP/);
    await expect(assertPublicUrl("https://user:pass@example.com/")).rejects.toThrow(/credentials/);
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(/http/);
  });

  test("allows a public host when DNS is injected", async () => {
    const url = await assertPublicUrl("https://example.com/a", {
      lookupImpl: async () => [{ address: "1.1.1.1" }],
    });
    expect(url.hostname).toBe("example.com");
  });

  test("rejects a host that resolves to a private address", async () => {
    await expect(
      assertPublicUrl("https://example.com/", {
        lookupImpl: async () => [{ address: "10.0.0.5" }],
      })
    ).rejects.toThrow(/blocked address/);
  });

  test("allows private hosts only when asked", async () => {
    const url = await assertPublicUrl("http://127.0.0.1:11434/", { allowPrivate: true });
    expect(url.hostname).toBe("127.0.0.1");
  });
});

describe("safeFetch", () => {
  test("returns a public response", async () => {
    const res = await safeFetch("https://example.com/a", {
      lookupImpl: async () => [{ address: "1.1.1.1" }],
      fetchImpl: async () => new Response("ok", { status: 200 }),
    });
    expect(await res.text()).toBe("ok");
  });

  test("does not follow a redirect to a private host", async () => {
    const fetchImpl = async (input: string | URL) => {
      const href = String(input);
      if (href.includes("127.0.0.1")) return new Response("secret", { status: 200 });
      return new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/secret" },
      });
    };
    await expect(
      safeFetch("https://example.com/start", {
        lookupImpl: async () => [{ address: "1.1.1.1" }],
        fetchImpl: fetchImpl as typeof fetch,
      })
    ).rejects.toThrow(/Blocked IP/);
  });

  test("refuses redirects when followRedirects is false", async () => {
    await expect(
      safeFetch("https://example.com/start", {
        followRedirects: false,
        lookupImpl: async () => [{ address: "1.1.1.1" }],
        fetchImpl: async () =>
          new Response(null, { status: 302, headers: { location: "https://example.com/next" } }),
      })
    ).rejects.toThrow(/Redirects are not allowed/);
  });
});
