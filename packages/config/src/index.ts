import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  INSTANCE_DOMAIN: z.string().min(1),
  INSTANCE_NAME: z.string().default("x-log"),
  ADMIN_EMAIL: z.string().email().optional(),
  OPEN_REGISTRATIONS: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
  SMTP_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().min(32),
  MCP_API_KEY: z.string().optional(), // Optional MCP API key (falls back to SESSION_SECRET)
  FEDERATION_ENABLED: z
    .string()
    .transform((val) => val !== "false")
    .default("true"),
  PORT: z.string().transform(Number).default("8080"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:8080"),
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

