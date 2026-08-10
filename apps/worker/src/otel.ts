/**
 * Optional OpenTelemetry bootstrap for the federation worker.
 * Same pattern as apps/api — only loads when OTEL_ENABLED=true.
 */
export async function startOtelIfEnabled(): Promise<void> {
  const enabled = process.env.OTEL_ENABLED === "true";
  if (!enabled) {
    return;
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    console.warn("[otel] OTEL_ENABLED=true but OTEL_EXPORTER_OTLP_ENDPOINT is unset; skipping");
    return;
  }

  try {
    const [
      { NodeSDK },
      { getNodeAutoInstrumentations },
      { OTLPTraceExporter },
      { resourceFromAttributes },
      { ATTR_SERVICE_NAME },
    ] = await Promise.all([
      import("@opentelemetry/sdk-node"),
      import("@opentelemetry/auto-instrumentations-node"),
      import("@opentelemetry/exporter-trace-otlp-http"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/semantic-conventions"),
    ]);

    const headers: Record<string, string> = {};
    const rawHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;
    if (rawHeaders) {
      for (const part of rawHeaders.split(",")) {
        const [k, ...rest] = part.split("=");
        if (k && rest.length) headers[k.trim()] = rest.join("=").trim();
      }
    }

    const serviceName = process.env.OTEL_SERVICE_NAME || "x-log-worker";
    const url = endpoint.replace(/\/$/, "") + "/v1/traces";

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: serviceName,
      }),
      traceExporter: new OTLPTraceExporter({
        url,
        headers,
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    await sdk.start();
    console.log(`[otel] started service=${serviceName} endpoint=${url}`);

    const shutdown = async () => {
      try {
        await sdk.shutdown();
      } catch (e) {
        console.error("[otel] shutdown error", e);
      }
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (err) {
    console.error("[otel] failed to start (is @opentelemetry/* installed?)", err);
  }
}

export async function withSpan<T>(
  name: string,
  attrs: Record<string, string | number | boolean | undefined> | undefined,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const api = await import("@opentelemetry/api");
    const tracer = api.trace.getTracer("x-log-worker");
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
