/**
 * Optional OTEL spans for ActivityPub crypto/network paths.
 * No-ops when @opentelemetry/api is missing or SDK is not started.
 */
export async function withSpan<T>(
  name: string,
  attrs: Record<string, string | number | boolean | undefined> | undefined,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const api = await import("@opentelemetry/api");
    const tracer = api.trace.getTracer("x-log-ap");
    return await tracer.startActiveSpan(name, async (span) => {
      if (attrs) {
        for (const [k, v] of Object.entries(attrs)) {
          if (v !== undefined) span.setAttribute(k, v);
        }
      }
      try {
        return await fn();
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: api.SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    });
  } catch {
    return fn();
  }
}
