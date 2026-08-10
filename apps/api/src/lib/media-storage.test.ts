import { describe, expect, test } from "bun:test";
import { makeObjectKey } from "./media-storage";

describe("makeObjectKey", () => {
  test("prefixes uuid and sanitizes path chars", () => {
    const key = makeObjectKey("../../etc/passwd.png");
    expect(key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/
    );
    expect(key).not.toContain("..");
    expect(key).not.toContain("/");
    expect(key.endsWith(".png") || key.includes("passwd")).toBe(true);
  });
});
