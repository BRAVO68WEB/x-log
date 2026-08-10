import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

/**
 * Structured API error body. Keeps `error` string for existing clients,
 * adds `code` and optional field `details` for better UX.
 */
export type ApiErrorBody = {
  error: string;
  code?: string;
  details?: Array<{ path: string; message: string }>;
  retry_after_sec?: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 = 400,
    public code?: string,
    public details?: ApiErrorBody["details"]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function formatZodIssues(err: ZodError): ApiErrorBody["details"] {
  return err.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

export function zodErrorMessage(err: ZodError): string {
  const details = formatZodIssues(err);
  if (!details?.length) return "Validation failed";
  if (details.length === 1) {
    const d = details[0];
    return d.path === "(root)" ? d.message : `${d.path}: ${d.message}`;
  }
  return `Validation failed (${details.length} issues)`;
}

export function errorJson(
  c: Context,
  status: number,
  body: ApiErrorBody
): Response {
  return c.json(body, status as 400);
}

/**
 * Map unknown thrown values into a consistent JSON response.
 */
export function mapThrownError(err: unknown): {
  status: number;
  body: ApiErrorBody;
} {
  if (err instanceof ApiError) {
    return {
      status: err.status,
      body: {
        error: err.message,
        code: err.code,
        details: err.details,
      },
    };
  }

  if (err instanceof HTTPException) {
    return {
      status: err.status,
      body: {
        error: err.message || "Request failed",
        code: err.status === 401 ? "unauthorized" : err.status === 403 ? "forbidden" : "http_error",
      },
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: zodErrorMessage(err),
        code: "validation_error",
        details: formatZodIssues(err),
      },
    };
  }

  // hono-openapi / standard-schema validators sometimes wrap issues
  if (err && typeof err === "object") {
    const anyErr = err as {
      status?: number;
      message?: string;
      name?: string;
      issues?: ZodError["issues"];
      cause?: unknown;
    };

    if (anyErr.cause instanceof ZodError) {
      return mapThrownError(anyErr.cause);
    }

    if (Array.isArray(anyErr.issues) && anyErr.issues.length > 0) {
      try {
        const zerr = new ZodError(anyErr.issues as ZodError["issues"]);
        return mapThrownError(zerr);
      } catch {
        /* fall through */
      }
    }

    if (
      typeof anyErr.status === "number" &&
      anyErr.status >= 400 &&
      anyErr.status < 600 &&
      typeof anyErr.message === "string"
    ) {
      return {
        status: anyErr.status,
        body: {
          error: anyErr.status === 500 ? "Internal server error" : anyErr.message,
          code: anyErr.status === 500 ? "internal_error" : "request_error",
        },
      };
    }
  }

  const message = err instanceof Error ? err.message : "Internal server error";
  // Avoid leaking internal stacks to clients
  return {
    status: 500,
    body: {
      error: "Internal server error",
      code: "internal_error",
      ...(process.env.NODE_ENV !== "production" && err instanceof Error
        ? { details: [{ path: "exception", message }] }
        : {}),
    },
  };
}
