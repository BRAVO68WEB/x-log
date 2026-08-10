import { describe, expect, test } from "bun:test";
import { etagMatches, mediaEtag } from "./media-cleanup";

describe("mediaEtag", () => {
  test("stable for same inputs", () => {
    const a = mediaEtag("abc-file.png", 1024, 1000);
    const b = mediaEtag("abc-file.png", 1024, 1000);
    expect(a).toBe(b);
    expect(a.startsWith('W/"')).toBe(true);
  });

  test("changes when size changes", () => {
    expect(mediaEtag("a.png", 1, 1)).not.toBe(mediaEtag("a.png", 2, 1));
  });
});

describe("etagMatches", () => {
  test("matches exact and star", () => {
    const tag = mediaEtag("x.png", 10, 5);
    expect(etagMatches(tag, tag)).toBe(true);
    expect(etagMatches("*", tag)).toBe(true);
    expect(etagMatches('W/"other"', tag)).toBe(false);
    expect(etagMatches(undefined, tag)).toBe(false);
  });
});
