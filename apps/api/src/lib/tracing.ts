/**
 * Lightweight OTEL span helper. No-ops when SDK is not started
 * (disabled by default via OTEL_ENABLED).
 */
export async function withSpan<T>(
  name: string,
  attrs: Record<string, string | number | boolean | undefined> | undefined,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const api = await import("@opentelemetry/api");
    const tracer = api.trace.getTracer("x-log");
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
    // OTEL API unavailable or no active SDK — run bare
    return fn();
  }
}

export async function withSpanSync<T>(
  name: string,
  attrs: Record<string, string | number | boolean | undefined> | undefined,
  fn: () => T
): Promise<T> {
  return withSpan(name, attrs, async () => fn());
}
