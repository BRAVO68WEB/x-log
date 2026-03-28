import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { InstanceSummaryResponseSchema } from "@xlog/validation";
import { getDb, getInstanceSettings } from "@xlog/db";

export const publicRoutes = new Hono();

publicRoutes.get(
  "/instance",
  describeRoute({
    description: "Get public instance summary",
    tags: ["public"],
    responses: {
      200: {
        description: "Instance summary",
        content: {
          "application/json": {
            schema: resolver(InstanceSummaryResponseSchema),
          },
        },
      },
    },
  }),
  async (c) => {
    const db = getDb();
    const settings = await getInstanceSettings();

    const totalPostsRow = await db
      .selectFrom("posts")
      .select((eb) => eb.fn.count<number>("id").as("count"))
      .where("visibility", "=", "public")
      .where("published_at", "is not", null)
      .executeTakeFirst();

    const adminPrimaryProfile = await db
      .selectFrom("users")
      .innerJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "users.username",
        "users.role",
        "users.created_at",
        "user_profiles.full_name",
        "user_profiles.avatar_url",
        "user_profiles.banner_url",
        "user_profiles.bio",
      ])
      .where("users.role", "=", "admin")
      .orderBy("users.created_at", "asc")
      .executeTakeFirst();

    const fallbackPrimaryProfile = adminPrimaryProfile
      ? null
      : await db
          .selectFrom("users")
          .innerJoin("user_profiles", "user_profiles.user_id", "users.id")
          .select([
            "users.username",
            "users.role",
            "users.created_at",
            "user_profiles.full_name",
            "user_profiles.avatar_url",
            "user_profiles.banner_url",
            "user_profiles.bio",
          ])
          .orderBy("users.created_at", "asc")
          .executeTakeFirst();

    const primaryProfile = adminPrimaryProfile ?? fallbackPrimaryProfile;

    return c.json({
      instance_name: settings.instance_name,
      instance_description: settings.instance_description,
      instance_domain: settings.instance_domain,
      total_public_posts: Number(totalPostsRow?.count || 0),
      primary_profile: primaryProfile
        ? {
            username: primaryProfile.username,
            full_name: primaryProfile.full_name,
            avatar_url: primaryProfile.avatar_url,
            banner_url: primaryProfile.banner_url,
            bio: primaryProfile.bio,
          }
        : null,
    });
  }
);
