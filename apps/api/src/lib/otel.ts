/**
 * Optional OpenTelemetry bootstrap. Loaded only when OTEL_ENABLED=true.
 * Dynamic import keeps the cold path free of heavy deps when disabled.
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
    const [{ NodeSDK }, { getNodeAutoInstrumentations }, { OTLPTraceExporter }, { resourceFromAttributes }, { ATTR_SERVICE_NAME }] =
      await Promise.all([
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

    const serviceName = process.env.OTEL_SERVICE_NAME || "x-log-api";
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
