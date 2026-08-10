import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { InstanceSummaryResponseSchema } from "@xlog/validation";
import {
  getDb,
  getInstanceSettings,
  getPrimaryUser,
  countLocalUsers,
  deriveInstanceMode,
} from "@xlog/db";

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
    const primary = await getPrimaryUser();
    const userCount = await countLocalUsers();

    const totalPostsRow = await db
      .selectFrom("posts")
      .select((eb) => eb.fn.count<number>("id").as("count"))
      .where("visibility", "=", "public")
      .where("published_at", "is not", null)
      .executeTakeFirst();

    let primaryProfile: {
      username: string;
      full_name: string | null;
      avatar_url: string | null;
      banner_url: string | null;
      bio: string | null;
    } | null = null;

    if (primary) {
      const profile = await db
        .selectFrom("users")
        .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
        .select([
          "users.username",
          "user_profiles.full_name",
          "user_profiles.avatar_url",
          "user_profiles.banner_url",
          "user_profiles.bio",
        ])
        .where("users.id", "=", primary.id)
        .executeTakeFirst();

      if (profile) {
        primaryProfile = {
          username: profile.username,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          banner_url: profile.banner_url,
          bio: profile.bio,
        };
      }
    }

    let openRegistrations = false;
    try {
      const { isOpenRegistrationsEnabled } = await import("../lib/registration");
      openRegistrations = await isOpenRegistrationsEnabled();
    } catch {
      /* ignore */
    }

    return c.json({
      instance_name: settings.instance_name,
      instance_description: settings.instance_description,
      instance_domain: settings.instance_domain,
      use_profile_as_landing: settings.use_profile_as_landing,
      theme_id: settings.theme_id,
      instance_mode: deriveInstanceMode(userCount),
      local_user_count: userCount,
      open_registrations: openRegistrations,
      total_public_posts: Number(totalPostsRow?.count || 0),
      primary_profile: primaryProfile,
    });
  }
);
