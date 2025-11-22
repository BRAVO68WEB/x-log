import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import {
  ProfileResponseSchema,
  ProfileUpdateSchema,
} from "@xlog/validation";
import { getDb } from "@xlog/db";
import {
  sessionMiddleware,
  requireAuth,
} from "../middleware/session";

export const profilesRoutes = new Hono().use("*", sessionMiddleware);

profilesRoutes.get(
  "/:username",
  describeRoute({
    description: "Get user profile",
    tags: ["profiles"],
    responses: {
      200: {
        description: "Profile",
        content: {
          "application/json": {
            schema: resolver(ProfileResponseSchema),
          },
        },
      },
      404: {
        description: "Profile not found",
      },
    },
  }),
  validator("param", z.object({
    username: z.string(),
  })),
  async (c) => {
    const { username } = c.req.valid("param");
    const db = getDb();

    const user = await db
      .selectFrom("users")
      .innerJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "users.username",
        "user_profiles.full_name",
        "user_profiles.bio",
        "user_profiles.social_github",
        "user_profiles.social_x",
        "user_profiles.social_youtube",
        "user_profiles.social_reddit",
        "user_profiles.social_linkedin",
        "user_profiles.social_website",
        "user_profiles.support_url",
        "user_profiles.support_text",
        "user_profiles.avatar_url",
        "user_profiles.banner_url",
      ])
      .where("users.username", "=", username)
      .executeTakeFirst();

    if (!user) {
      return c.json({ error: "Profile not found" }, 404);
    }

    return c.json(user);
  }
);

profilesRoutes.patch(
  "/:username",
  describeRoute({
    description: "Update user profile",
    tags: ["profiles"],
    responses: {
      200: {
        description: "Profile updated",
        content: {
          "application/json": {
            schema: resolver(ProfileResponseSchema),
          },
        },
      },
    },
  }),
  validator("param", z.object({
    username: z.string(),
  })),
  validator("json", ProfileUpdateSchema),
  requireAuth,
  async (c) => {
    const currentUser = c.get("user")!;
    const { username } = c.req.valid("param");
    const data = c.req.valid("json");
    const db = getDb();

    // Check authorization
    const user = await db
      .selectFrom("users")
      .select("id")
      .where("username", "=", username)
      .executeTakeFirst();

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (user.id !== currentUser.id && currentUser.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db
      .updateTable("user_profiles")
      .set(data)
      .where("user_id", "=", user.id)
      .execute();

    const updated = await db
      .selectFrom("users")
      .innerJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "users.username",
        "user_profiles.full_name",
        "user_profiles.bio",
        "user_profiles.social_github",
        "user_profiles.social_x",
        "user_profiles.social_youtube",
        "user_profiles.social_reddit",
        "user_profiles.social_linkedin",
        "user_profiles.social_website",
        "user_profiles.support_url",
        "user_profiles.support_text",
        "user_profiles.avatar_url",
        "user_profiles.banner_url",
      ])
      .where("users.username", "=", username)
      .executeTakeFirst();

    return c.json(updated!);
  }
);

