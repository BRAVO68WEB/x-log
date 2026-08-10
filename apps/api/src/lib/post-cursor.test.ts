import { describe, expect, test } from "bun:test";
import { decodePostCursor, encodePostCursor } from "./post-cursor";

describe("post list cursor", () => {
  test("round-trips sort time and id", () => {
    const t = new Date("2026-01-15T12:34:56.789Z");
    const id = "123456789012345678";
    const enc = encodePostCursor(t, id);
    const dec = decodePostCursor(enc);
    expect(dec).not.toBeNull();
    expect(dec!.id).toBe(id);
    expect(dec!.sortAt.toISOString()).toBe(t.toISOString());
  });

  test("rejects garbage", () => {
    expect(decodePostCursor("")).toBeNull();
    expect(decodePostCursor("not-valid")).toBeNull();
    expect(decodePostCursor(undefined)).toBeNull();
  });

  test("legacy plain id cursor returns null (restart page)", () => {
    // Plain snowflake without encoding — intentionally not supported for keyset
    expect(decodePostCursor("123456789012345678")).toBeNull();
  });
});
