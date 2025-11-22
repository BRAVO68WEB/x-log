import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { SearchQuerySchema } from "@xlog/validation";
import { getDb } from "@xlog/db";
import { sql } from "kysely";

export const searchRoutes = new Hono();

searchRoutes.get(
  "/",
  describeRoute({
    description: "Search posts and profiles",
    tags: ["search"],
    responses: {
      200: {
        description: "Search results",
      },
    },
  }),
  validator("query", SearchQuerySchema),
  async (c) => {
    const { q, type, limit } = c.req.valid("query");
    const db = getDb();

    if (type === "post" || !type) {
      const posts = await db
        .selectFrom("posts")
        .innerJoin("users", "users.id", "posts.author_id")
        .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
        .select([
          "posts.id",
          "posts.title",
          "posts.content_markdown",
          "posts.published_at",
          "users.username",
          "user_profiles.full_name",
        ])
        .where("posts.visibility", "=", "public")
        .where("posts.published_at", "is not", null)
        .where(
          sql`to_tsvector('english', posts.title || ' ' || posts.content_markdown)`,
          "@@",
          sql`plainto_tsquery('english', ${q})`
        )
        .orderBy("posts.published_at", "desc")
        .limit(limit)
        .execute();

      return c.json({
        type: "post",
        items: posts,
      });
    }

    if (type === "profile") {
      const profiles = await db
        .selectFrom("users")
        .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
        .select([
          "users.username",
          "user_profiles.full_name",
          "user_profiles.bio",
        ])
        .where((eb) =>
          eb.or([
            eb("users.username", "like", `%${q}%`),
            eb("user_profiles.full_name", "like", `%${q}%`),
          ])
        )
        .limit(limit)
        .execute();

      return c.json({
        type: "profile",
        items: profiles,
      });
    }

    return c.json({ items: [] });
  }
);

