import { describe, expect, test } from "bun:test";
import { hostFromUrlOrActor } from "./federation-blocks";

describe("hostFromUrlOrActor", () => {
  test("URL host", () => {
    expect(hostFromUrlOrActor("https://mastodon.social/users/alice")).toBe(
      "mastodon.social"
    );
  });

  test("acct handle", () => {
    expect(hostFromUrlOrActor("acct:bob@example.com")).toBe("example.com");
    expect(hostFromUrlOrActor("bob@other.social")).toBe("other.social");
  });

  test("strips path and port from bare host", () => {
    expect(hostFromUrlOrActor("https://evil.test:443/path")).toBe("evil.test");
  });
});
