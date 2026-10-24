import { describe, expect, test } from "bun:test";
import { signatureConstraintError } from "./signature";

const REQUIRED = ["(request-target)", "host", "date"];

describe("signatureConstraintError", () => {
  test("accepts rsa-sha256, hs2019, and an omitted algorithm", () => {
    expect(signatureConstraintError("GET", REQUIRED, "rsa-sha256", false)).toBeNull();
    expect(signatureConstraintError("GET", REQUIRED, "hs2019", false)).toBeNull();
    expect(signatureConstraintError("GET", REQUIRED, undefined, false)).toBeNull();
  });

  test("rejects none and hmac", () => {
    expect(signatureConstraintError("GET", REQUIRED, "none", false)).toMatch(/algorithm/);
    expect(signatureConstraintError("POST", [...REQUIRED, "digest"], "hmac-sha256", true)).toMatch(
      /algorithm/
    );
  });

  test("requires digest on POST and the core signed headers", () => {
    expect(signatureConstraintError("POST", REQUIRED, "rsa-sha256", true)).toMatch(/digest/);
    expect(signatureConstraintError("POST", [...REQUIRED, "digest"], "rsa-sha256", false)).toMatch(
      /digest header/
    );
    expect(signatureConstraintError("POST", ["(request-target)", "host", "digest"], "rsa-sha256", true)).toMatch(
      /date/
    );
    expect(signatureConstraintError("POST", [...REQUIRED, "digest"], "rsa-sha256", true)).toBeNull();
  });
});
