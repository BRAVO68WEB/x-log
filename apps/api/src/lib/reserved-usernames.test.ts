import { describe, expect, test } from "bun:test";
import { isReservedUsername } from "./reserved-usernames";

describe("isReservedUsername", () => {
  test("blocks system names", () => {
    expect(isReservedUsername("admin")).toBe(true);
    expect(isReservedUsername("API")).toBe(true);
    expect(isReservedUsername("settings")).toBe(true);
  });

  test("allows normal names", () => {
    expect(isReservedUsername("alice")).toBe(false);
    expect(isReservedUsername("bravo68web")).toBe(false);
  });
});
