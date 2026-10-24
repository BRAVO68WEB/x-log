import { describe, expect, test } from "bun:test";
import { checkRateLimit, clientIpFromProxy } from "./rate-limit";

describe("clientIpFromProxy", () => {
  test("ignores forwarding headers when no proxy is trusted", () => {
    expect(
      clientIpFromProxy({
        hops: 0,
        socketAddress: "203.0.113.8",
        cfConnectingIp: "1.2.3.4",
        forwardedFor: "10.0.0.1, 203.0.113.8",
      })
    ).toBe("203.0.113.8");
  });

  test("uses the proxy-appended hop, not the client-supplied left value", () => {
    expect(
      clientIpFromProxy({
        hops: 1,
        socketAddress: "127.0.0.1",
        forwardedFor: "1.1.1.1, 198.51.100.20",
      })
    ).toBe("198.51.100.20");
  });

  test("prefers CF-Connecting-IP only when hops are trusted", () => {
    expect(
      clientIpFromProxy({
        hops: 1,
        socketAddress: "127.0.0.1",
        cfConnectingIp: "203.0.113.9",
        forwardedFor: "1.1.1.1",
      })
    ).toBe("203.0.113.9");
  });
});

describe("checkRateLimit", () => {
  test("allows up to limit then blocks", () => {
    const key = `test-${Date.now()}-${Math.random()}`;
    const opts = { limit: 3, windowMs: 60_000 };

    expect(checkRateLimit(key, opts).ok).toBe(true);
    expect(checkRateLimit(key, opts).ok).toBe(true);
    expect(checkRateLimit(key, opts).ok).toBe(true);

    const blocked = checkRateLimit(key, opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  test("independent keys", () => {
    const a = `a-${Date.now()}-${Math.random()}`;
    const b = `b-${Date.now()}-${Math.random()}`;
    const opts = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit(a, opts).ok).toBe(true);
    expect(checkRateLimit(b, opts).ok).toBe(true);
    expect(checkRateLimit(a, opts).ok).toBe(false);
  });
});
