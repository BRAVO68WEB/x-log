import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { OnboardingStateSchema, OnboardingCompleteSchema } from "@xlog/validation";
import { getDb } from "@xlog/db";
import bcrypt from "bcryptjs";
import { generateKeyPairSync } from "crypto";
import { sealSecret } from "../lib/seal-secret";

const LOCAL_USERNAME = /^[a-z0-9_]{3,32}$/;

function isUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = err;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const row = current as { code?: string; message?: string; cause?: unknown };
    if (row.code === "23505") return true;
    if (typeof row.message === "string" && /duplicate key|unique constraint/i.test(row.message)) {
      return true;
    }
    current = row.cause;
  }
  return false;
}

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
    const data = c.req.valid("json");
    if (!LOCAL_USERNAME.test(data.admin_username)) {
      return c.json(
        { error: "Username must be 3-32 characters: lowercase letters, digits, underscore" },
        400
      );
    }

    const db = getDb();
    const passwordHash = await bcrypt.hash(data.admin_password, 10);
    const userId = crypto.randomUUID();
    const { publicKey, privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    const keyId = `https://${data.instance_domain}/ap/users/${data.admin_username}#main-key`;

    try {
      await db.transaction().execute(async (trx) => {
        const existing = await trx
          .selectFrom("instance_settings")
          .select("id")
          .where("id", "=", 1)
          .executeTakeFirst();
        if (existing) {
          throw Object.assign(new Error("Onboarding already completed"), { code: "ALREADY" });
        }

        await trx
          .insertInto("users")
          .values({
            id: userId,
            username: data.admin_username,
            email: data.admin_email || null,
            password_hash: passwordHash,
            role: "admin",
          })
          .execute();

        await trx.insertInto("user_profiles").values({ user_id: userId }).execute();

        await trx
          .insertInto("user_keys")
          .values({
            user_id: userId,
            public_key_pem: publicKey,
            private_key_pem: sealSecret(privateKey),
            key_id: keyId,
          })
          .execute();

        await trx
          .insertInto("instance_settings")
          .values({
            id: 1,
            instance_name: data.instance_name,
            instance_description: data.instance_description || null,
            instance_domain: data.instance_domain,
            open_registrations: false,
            admin_email: data.admin_email || null,
            smtp_url: data.smtp_url || null,
            federation_enabled: true,
            following_enabled: false,
            use_profile_as_landing: false,
            primary_user_id: userId,
            theme_id: "system",
          })
          .execute();
      });
    } catch (err) {
      if ((err as { code?: string }).code === "ALREADY") {
        return c.json({ error: "Onboarding already completed" }, 400);
      }
      if (isUniqueViolation(err)) {
        const done = await db
          .selectFrom("instance_settings")
          .select("id")
          .where("id", "=", 1)
          .executeTakeFirst();
        return c.json(
          { error: done ? "Onboarding already completed" : "Username is taken" },
          400
        );
      }
      throw err;
    }

    return c.json({ message: "Onboarding completed" });
  }
);
