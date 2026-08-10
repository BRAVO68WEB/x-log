import { describe, expect, test } from "bun:test";
import { ZodError, z } from "zod";
import { formatZodIssues, mapThrownError, zodErrorMessage, ApiError } from "./http-error";
import { HTTPException } from "hono/http-exception";

describe("formatZodIssues", () => {
  test("maps paths and messages", () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().int().min(0),
    });
    const parsed = schema.safeParse({ email: "nope", age: -1 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const details = formatZodIssues(parsed.error)!;
    expect(details.length).toBeGreaterThanOrEqual(2);
    expect(details.some((d) => d.path === "email")).toBe(true);
    expect(details.some((d) => d.path === "age")).toBe(true);
  });
});

describe("zodErrorMessage", () => {
  test("single issue is readable", () => {
    const err = new ZodError([
      {
        code: "too_small",
        minimum: 8,
        type: "string",
        inclusive: true,
        exact: false,
        message: "String must contain at least 8 character(s)",
        path: ["password"],
      },
    ]);
    expect(zodErrorMessage(err)).toContain("password");
  });
});

describe("mapThrownError", () => {
  test("ApiError", () => {
    const r = mapThrownError(new ApiError("Nope", 403, "forbidden"));
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("forbidden");
  });

  test("HTTPException", () => {
    const r = mapThrownError(new HTTPException(401, { message: "nope" }));
    expect(r.status).toBe(401);
    expect(r.body.code).toBe("unauthorized");
  });

  test("unknown becomes 500 without leaking message in production shape", () => {
    const r = mapThrownError(new Error("secret db password"));
    expect(r.status).toBe(500);
    expect(r.body.error).toBe("Internal server error");
    expect(r.body.code).toBe("internal_error");
  });
});
