import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";
import { getDb, getInstanceSettings } from "@xlog/db";
import { generateId } from "@xlog/snowflake";
import { getPostUrlSync, getActorUrlSync, getFollowersUrlSync } from "@xlog/ap";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { enqueueDeliveriesToFollowers } from "../lib/redis";
import { isFeatureEnabled } from "../lib/features";

export const repostsRoutes = new Hono().use("*", sessionMiddleware);

repostsRoutes.post(
  "/:id/repost",
  describeRoute({
    description: "Repost (boost) a post",
    tags: ["reposts"],
    responses: {
      201: { description: "Repost created" },
      403: { description: "Feature disabled" },
      404: { description: "Post not found" },
      409: { description: "Already reposted" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("reposts");
    if (!enabled) return c.json({ error: "Reposts feature is not enabled" }, 403);

    const user = c.get("user")!;
    const sourceId = c.req.param("id");
    const db = getDb();

    const source = await db
      .selectFrom("posts")
      .select(["id", "title", "visibility", "content_markdown"])
      .where("id", "=", sourceId)
      .where("published_at", "is not", null)
      .executeTakeFirst();

    if (!source) return c.json({ error: "Post not found" }, 404);

    const existing = await db
      .selectFrom("posts")
      .select(["id"])
      .where("author_id", "=", user.id)
      .where("repost_of_id", "=", sourceId)
      .executeTakeFirst();

    if (existing) return c.json({ error: "Already reposted", id: existing.id }, 409);

    const settings = await getInstanceSettings();
    const id = generateId();
    const apObjectId = `https://${settings.instance_domain}/post/${id}`;
    const preview = source.content_markdown.split("\n").slice(0, 3).join("\n> ");

    await db
      .insertInto("posts")
      .values({
        id,
        author_id: user.id,
        title: source.title,
        content_markdown: `> ${preview}...`,
        summary: null,
        hashtags: [],
        like_count: 0,
        visibility: source.visibility,
        ap_object_id: apObjectId,
        repost_of_id: sourceId,
      })
      .execute();

    try {
      const objectUrl = getPostUrlSync(sourceId, settings.instance_domain);
      await enqueueDeliveriesToFollowers(
        user.id,
        id,
        `${apObjectId}#announce`,
        "Create",
        settings.instance_domain
      );
    } catch (err) {
      console.error("[repost] Federation delivery failed:", err);
    }

    return c.json({ id, repost_of: sourceId }, 201);
  }
);

repostsRoutes.delete(
  "/:id/repost",
  describeRoute({
    description: "Undo a repost",
    tags: ["reposts"],
    responses: {
      200: { description: "Repost removed" },
      403: { description: "Feature disabled" },
      404: { description: "Repost not found" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("reposts");
    if (!enabled) return c.json({ error: "Reposts feature is not enabled" }, 403);

    const user = c.get("user")!;
    const sourceId = c.req.param("id");
    const db = getDb();

    const repost = await db
      .selectFrom("posts")
      .select(["id"])
      .where("author_id", "=", user.id)
      .where("repost_of_id", "=", sourceId)
      .executeTakeFirst();

    if (!repost) return c.json({ error: "Repost not found" }, 404);

    await db.deleteFrom("posts").where("id", "=", repost.id).execute();
    return c.json({ deleted: repost.id });
  }
);

repostsRoutes.get(
  "/:id/reposts",
  describeRoute({
    description: "Get reposts of a post",
    tags: ["reposts"],
    responses: {
      200: { description: "Repost list" },
      403: { description: "Feature disabled" },
    },
  }),
  async (c) => {
    const enabled = await isFeatureEnabled("reposts");
    if (!enabled) return c.json({ error: "Reposts feature is not enabled" }, 403);

    const sourceId = c.req.param("id");
    const db = getDb();

    const reposts = await db
      .selectFrom("posts")
      .leftJoin("users", "users.id", "posts.author_id")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "posts.id",
        "posts.author_id",
        "posts.updated_at",
        "users.username",
        "user_profiles.full_name",
        "user_profiles.avatar_url",
      ])
      .where("posts.repost_of_id", "=", sourceId)
      .orderBy("posts.updated_at", "desc")
      .limit(50)
      .execute();

    return c.json({
      count: reposts.length,
      items: reposts.map((r) => ({
        id: r.id,
        user: {
          id: r.author_id,
          username: r.username,
          full_name: r.full_name,
          avatar_url: r.avatar_url,
        },
        created_at: r.updated_at.toISOString(),
      })),
    });
  }
);
