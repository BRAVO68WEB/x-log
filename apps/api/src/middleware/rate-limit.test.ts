import { describe, expect, test } from "bun:test";
import { SENSITIVE_RATE_LIMIT_RULES } from "./rate-limit";

describe("SENSITIVE_RATE_LIMIT_RULES", () => {
  test("matches login POSTs", () => {
    const login = SENSITIVE_RATE_LIMIT_RULES.find((r) => r.key === "auth-login");
    expect(login).toBeDefined();
    expect(login!.match("/api/auth/login", "POST")).toBe(true);
    expect(login!.match("/api/auth/login", "GET")).toBe(false);
    expect(login!.match("/api/auth/register", "POST")).toBe(false);
  });

  test("matches forgot-password and collect", () => {
    const forgot = SENSITIVE_RATE_LIMIT_RULES.find((r) => r.key === "auth-forgot");
    const collect = SENSITIVE_RATE_LIMIT_RULES.find((r) => r.key === "analytics-collect");
    expect(forgot!.match("/api/auth/forgot-password", "POST")).toBe(true);
    expect(collect!.match("/api/analytics/collect", "POST")).toBe(true);
    expect(collect!.match("/api/analytics/status", "GET")).toBe(false);
  });

  test("media upload is limited", () => {
    const media = SENSITIVE_RATE_LIMIT_RULES.find((r) => r.key === "media-upload");
    expect(media!.match("/api/media/upload", "POST")).toBe(true);
    expect(media!.match("/api/media", "GET")).toBe(false);
  });
});
