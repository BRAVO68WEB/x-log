import { describe, expect, test } from "bun:test";
import { safeAppPath } from "./app-path";

describe("safeAppPath", () => {
  test("keeps same-origin paths", () => {
    expect(safeAppPath("/settings")).toBe("/settings");
    expect(safeAppPath("/login/link?state=abc")).toBe("/login/link?state=abc");
  });

  test("rejects open redirects", () => {
    expect(safeAppPath("//evil.example")).toBe("/");
    expect(safeAppPath("/\\evil.example")).toBe("/");
    expect(safeAppPath("https://evil.example")).toBe("/");
    expect(safeAppPath(null)).toBe("/");
  });
});
