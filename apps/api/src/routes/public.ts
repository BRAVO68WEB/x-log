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

/** Public author directory (multi-user). Empty list when solo. */
publicRoutes.get("/authors", async (c) => {
  const db = getDb();
  const userCount = await countLocalUsers();
  const mode = deriveInstanceMode(userCount);

  if (mode === "solo") {
    return c.json({ instance_mode: "solo", authors: [] });
  }

  const rows = await db
    .selectFrom("users")
    .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
    .select([
      "users.username",
      "users.role",
      "user_profiles.full_name",
      "user_profiles.bio",
      "user_profiles.avatar_url",
    ])
    .where("users.role", "in", ["admin", "author"])
    .where("users.is_active", "=", true)
    .orderBy("users.created_at", "asc")
    .execute();

  // Post counts per author
  const counts = await db
    .selectFrom("posts")
    .innerJoin("users", "users.id", "posts.author_id")
    .select(["users.username"])
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("posts.published_at", "is not", null)
    .where("posts.visibility", "=", "public")
    .groupBy("users.username")
    .execute();
  const countMap = new Map(counts.map((r) => [r.username, Number(r.count)]));

  return c.json({
    instance_mode: "multi",
    authors: rows.map((r) => ({
      username: r.username,
      role: r.role,
      full_name: r.full_name,
      bio: r.bio,
      avatar_url: r.avatar_url,
      public_post_count: countMap.get(r.username) || 0,
      profile_path: `/u/${r.username}`,
      rss_path: `/api/feeds/${r.username}/rss`,
      atom_path: `/api/feeds/${r.username}/atom`,
    })),
  });
});

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
