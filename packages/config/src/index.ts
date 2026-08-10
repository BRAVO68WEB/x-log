import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  INSTANCE_DOMAIN: z.string().min(1),
  INSTANCE_NAME: z.string().default("x-log"),
  ADMIN_EMAIL: z.string().optional(),
  OPEN_REGISTRATIONS: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  SMTP_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32),
  /** Dedicated MCP Bearer key. When unset, MCP is disabled in production. */
  MCP_API_KEY: z.string().min(16).optional(),
  /**
   * Explicit MCP toggle: "true" | "false".
   * Default (unset): enabled when MCP_API_KEY is set (or in development
   * with SESSION_SECRET fallback).
   */
  MCP_ENABLED: z.enum(["true", "false"]).optional(),
  /** Local username write tools act as (defaults to primary admin user). */
  MCP_ACTOR_USERNAME: z.string().min(1).optional(),
  FEDERATION_ENABLED: z
    .string()
    .transform((val) => val !== "false")
    .default("true"),
  /** Cap on local author+admin accounts (invite/open reg). Default 10. */
  MAX_LOCAL_AUTHORS: z.coerce.number().int().min(1).max(1000).default(10),
  PORT: z.string().transform(Number).default("8080"),
  NEXT_PUBLIC_API_URL: z.string().default("http://localhost:8080"),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),
  OIDC_REDIRECT_URI: z.string().min(1),
  OIDC_DISCOVERY_URL: z.string().min(1),

  // First-party analytics (also gated by feature flag "analytics")
  ANALYTICS_SALT: z.string().optional(),
  ANALYTICS_STORE_RAW_IP: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  ANALYTICS_RESPECT_DNT: z
    .string()
    .transform((v) => v !== "false")
    .default("true"),
  ANALYTICS_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),

  // OpenTelemetry (opt-in)
  OTEL_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default("x-log-api"),
  OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).default(0.1),

  // PostHog (opt-in; client uses NEXT_PUBLIC_*)
  POSTHOG_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().default("https://us.i.posthog.com"),
  POSTHOG_SERVER_ENABLED: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_ENABLED: z.string().optional(),

  // Media storage (local default; S3-compatible for R2/S3/MinIO)
  MEDIA_DRIVER: z.enum(["local", "s3"]).default("local"),
  MEDIA_S3_ENDPOINT: z.string().optional(),
  MEDIA_S3_REGION: z.string().default("auto"),
  MEDIA_S3_BUCKET: z.string().optional(),
  MEDIA_S3_ACCESS_KEY_ID: z.string().optional(),
  MEDIA_S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** Public base URL for objects (no trailing slash), e.g. https://cdn.example.com */
  MEDIA_S3_PUBLIC_URL: z.string().optional(),
  /** Path-style URLs (MinIO / some S3-compatible). Default true when endpoint set. */
  MEDIA_S3_FORCE_PATH_STYLE: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  /** Key prefix inside bucket, e.g. "xlog/" */
  MEDIA_S3_PREFIX: z.string().default(""),
});

export type Env = z.infer<typeof envSchema>;

let env: Env | null = null;

export function getEnv(): Env {
  if (!env) {
    env = envSchema.parse(process.env);
  }
  return env;
}

export function validateEnv(): void {
  getEnv();
}
