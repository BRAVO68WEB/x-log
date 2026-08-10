import { describe, expect, test } from "bun:test";
import {
  clientIpFromHeaders,
  isBotUserAgent,
  parseReferrerHost,
  shouldSkipCollectInput,
} from "./analytics";

describe("isBotUserAgent", () => {
  test("empty UA is bot", () => {
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
  });

  test("browser UA is not bot", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0"
      )
    ).toBe(false);
  });

  test("known bots", () => {
    expect(isBotUserAgent("Googlebot/2.1")).toBe(true);
    expect(isBotUserAgent("curl/8.0")).toBe(true);
    expect(isBotUserAgent("python-requests/2.28")).toBe(true);
  });
});

describe("parseReferrerHost", () => {
  test("parses hostname", () => {
    expect(parseReferrerHost("https://news.ycombinator.com/item?id=1")).toBe(
      "news.ycombinator.com"
    );
  });

  test("null/invalid", () => {
    expect(parseReferrerHost(null)).toBe(null);
    expect(parseReferrerHost("not-a-url")).toBe(null);
  });
});

describe("shouldSkipCollectInput", () => {
  test("skips DNT when respected", () => {
    expect(
      shouldSkipCollectInput({
        path: "/post/1",
        userAgent: "Mozilla/5.0",
        dnt: true,
        respectDnt: true,
      })
    ).toBe("dnt");
  });

  test("allows DNT when respect off", () => {
    expect(
      shouldSkipCollectInput({
        path: "/post/1",
        userAgent: "Mozilla/5.0",
        dnt: true,
        respectDnt: false,
      })
    ).toBe(null);
  });

  test("skips bots and bad paths", () => {
    expect(
      shouldSkipCollectInput({ path: "/x", userAgent: "curl/1", respectDnt: true })
    ).toBe("bot");
    expect(
      shouldSkipCollectInput({
        path: "relative",
        userAgent: "Mozilla/5.0",
        respectDnt: true,
      })
    ).toBe("path");
  });
});

describe("clientIpFromHeaders", () => {
  test("prefers cf-connecting-ip then xff", () => {
    const h = new Map<string, string>([
      ["cf-connecting-ip", "1.2.3.4"],
      ["x-forwarded-for", "9.9.9.9, 8.8.8.8"],
    ]);
    expect(clientIpFromHeaders({ get: (n) => h.get(n.toLowerCase()) ?? null })).toBe(
      "1.2.3.4"
    );
  });

  test("xff first hop", () => {
    const h = new Map([["x-forwarded-for", " 10.0.0.1, 10.0.0.2 "]]);
    expect(clientIpFromHeaders({ get: (n) => h.get(n) ?? null })).toBe("10.0.0.1");
  });
});
