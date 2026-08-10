import { describe, expect, test } from "bun:test";
import { checkRateLimit } from "./rate-limit";

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
