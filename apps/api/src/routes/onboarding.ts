import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import {
  OnboardingStateSchema,
  OnboardingCompleteSchema,
} from "@xlog/validation";
import { getDb } from "@xlog/db";
import { getEnv } from "@xlog/config";
import bcrypt from "bcryptjs";
import { generateKeyPairSync } from "crypto";

export const onboardingRoutes = new Hono();

onboardingRoutes.get(
  "/state",
  describeRoute({
    description: "Get onboarding state",
    tags: ["onboarding"],
    responses: {
      200: {
        description: "Onboarding state",
        content: {
          "application/json": {
            schema: resolver(OnboardingStateSchema),
          },
        },
      },
    },
  }),
  async (c) => {
    const db = getDb();
    const settings = await db
      .selectFrom("instance_settings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirst();

    if (settings) {
      return c.json({ completed: true, step: 6 });
    }

    return c.json({ completed: false, step: 1 });
  }
);

onboardingRoutes.post(
  "/complete",
  describeRoute({
    description: "Complete onboarding setup",
    tags: ["onboarding"],
    responses: {
      200: {
        description: "Onboarding completed",
      },
      400: {
        description: "Onboarding already completed",
      },
    },
  }),
  validator("json", OnboardingCompleteSchema),
  async (c) => {
    const db = getDb();
    const existing = await db
      .selectFrom("instance_settings")
      .selectAll()
      .where("id", "=", 1)
      .executeTakeFirst();

    if (existing) {
      return c.json({ error: "Onboarding already completed" }, 400);
    }

    const data = c.req.valid("json");

    // Create admin user
    const passwordHash = await bcrypt.hash(data.admin_password, 10);
    const userId = crypto.randomUUID();

    await db
      .insertInto("users")
      .values({
        id: userId,
        username: data.admin_username,
        email: data.admin_email || null,
        password_hash: passwordHash,
        role: "admin",
      })
      .execute();

    // Create user profile
    await db
      .insertInto("user_profiles")
      .values({
        user_id: userId,
      })
      .execute();

    // Generate key pair for ActivityPub
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    const env = getEnv();
    const keyId = `https://${data.instance_domain}/ap/users/${data.admin_username}#main-key`;

    await db
      .insertInto("user_keys")
      .values({
        user_id: userId,
        public_key_pem: publicKey,
        private_key_pem: privateKey, // TODO: Encrypt at rest
        key_id: keyId,
      })
      .execute();

    // Create instance settings
    await db
      .insertInto("instance_settings")
      .values({
        id: 1,
        instance_name: data.instance_name,
        instance_description: data.instance_description || null,
        instance_domain: data.instance_domain,
        open_registrations: data.open_registrations,
        admin_email: data.admin_email || null,
        smtp_url: data.smtp_url || null,
        federation_enabled: true,
      })
      .execute();

    return c.json({ message: "Onboarding completed" });
  }
);

