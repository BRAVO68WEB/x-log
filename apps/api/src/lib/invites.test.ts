import { describe, expect, test } from "bun:test";
import { generateInviteToken, hashInviteToken, inviteStatus } from "./invites";

describe("invite tokens", () => {
  test("generate is high entropy", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
  });

  test("hash is stable and hex", () => {
    const t = "test-token";
    expect(hashInviteToken(t)).toBe(hashInviteToken(t));
    expect(hashInviteToken(t)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashInviteToken(t)).not.toBe(hashInviteToken("other"));
  });
});

describe("inviteStatus", () => {
  test("valid / expired / accepted / revoked", () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    expect(
      inviteStatus({ expires_at: future, accepted_at: null, revoked_at: null })
    ).toBe("valid");
    expect(
      inviteStatus({ expires_at: past, accepted_at: null, revoked_at: null })
    ).toBe("expired");
    expect(
      inviteStatus({
        expires_at: future,
        accepted_at: new Date(),
        revoked_at: null,
      })
    ).toBe("accepted");
    expect(
      inviteStatus({
        expires_at: future,
        accepted_at: null,
        revoked_at: new Date(),
      })
    ).toBe("revoked");
  });
});
