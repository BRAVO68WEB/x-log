import { describe, expect, test } from "bun:test";
import { deriveInstanceMode } from "./primary-user";

describe("deriveInstanceMode", () => {
  test("solo when zero users (pre-onboarding)", () => {
    expect(deriveInstanceMode(0)).toBe("solo");
  });

  test("solo when exactly one local user", () => {
    expect(deriveInstanceMode(1)).toBe("solo");
  });

  test("multi when two or more local users", () => {
    expect(deriveInstanceMode(2)).toBe("multi");
    expect(deriveInstanceMode(10)).toBe("multi");
  });
});
