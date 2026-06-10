import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod";
import { getDb, getInstanceSettings } from "@xlog/db";
import { generateId } from "@xlog/snowflake";
import { getActorUrlSync, getPostUrlSync } from "@xlog/ap";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { enqueueDeliveriesToFollowers } from "../lib/redis";
import { isFeatureEnabled } from "../lib/features";

const ThreadCreateSchema = z.object({
  title: z.string().max(200).optional(),
  posts: z.array(z.object({
    content_markdown: z.string().min(1).max(10000),
    title: z.string().max(200).optional(),
  })).min(2).max(50),
});

export const threadsRoutes = new Hono().use("*", sessionMiddleware);

threadsRoutes.post(
  "/",
  describeRoute({
    description: "Create a new thread with multiple posts",
    tags: ["threads"],
    responses: {
      201: { description: "Thread created" },
      403: { description: "Feature disabled" },
    },
  }),
  validator("json", ThreadCreateSchema),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("threads");
    if (!enabled) return c.json({ error: "Threads feature is not enabled" }, 403);

    const user = c.get("user")!;
    const body = c.req.valid("json");
    const db = getDb();
    const settings = await getInstanceSettings();

    const threadId = generateId();

    await db.insertInto("threads").values({
      id: threadId,
      user_id: user.id,
      title: body.title ?? null,
    }).execute();

    const postIds: string[] = [];
    for (let i = 0; i < body.posts.length; i++) {
      const post = body.posts[i];
      const postId = generateId();
      const apObjectId = `https://${settings.instance_domain}/post/${postId}`;

      await db.insertInto("posts").values({
        id: postId,
        author_id: user.id,
        title: post.title ?? body.title ?? "",
        content_markdown: post.content_markdown,
        summary: null,
        hashtags: [],
        like_count: 0,
        visibility: "public",
        ap_object_id: apObjectId,
        thread_id: threadId,
        thread_position: i + 1,
      }).execute();

      postIds.push(postId);
    }

    await db.updateTable("posts").set({ published_at: new Date() }).where("thread_id", "=", threadId).execute();

    try {
      await enqueueDeliveriesToFollowers(
        user.id,
        postIds[0],
        `https://${settings.instance_domain}/post/${postIds[0]}#create`,
        "Create",
        settings.instance_domain
      );
    } catch (err) {
      console.error("[thread] Federation delivery failed:", err);
    }

    return c.json({ id: threadId, post_ids: postIds }, 201);
  }
);

threadsRoutes.get(
  "/:id",
  describeRoute({
    description: "Get a thread with all its posts",
    tags: ["threads"],
    responses: {
      200: { description: "Thread with posts" },
      404: { description: "Thread not found" },
    },
  }),
  async (c) => {
    const enabled = await isFeatureEnabled("threads");
    if (!enabled) return c.json({ error: "Threads feature is not enabled" }, 403);

    const id = c.req.param("id");
    const db = getDb();

    const thread = await db
      .selectFrom("threads")
      .leftJoin("users", "users.id", "threads.user_id")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "threads.id", "threads.title", "threads.user_id", "threads.created_at",
        "users.username", "user_profiles.full_name", "user_profiles.avatar_url",
      ])
      .where("threads.id", "=", id)
      .executeTakeFirst();

    if (!thread) return c.json({ error: "Thread not found" }, 404);

    const posts = await db
      .selectFrom("posts")
      .select(["id", "title", "content_markdown", "like_count", "published_at", "thread_position"])
      .where("thread_id", "=", id)
      .orderBy("thread_position", "asc")
      .execute();

    return c.json({
      thread: {
        id: thread.id,
        title: thread.title,
        user: { id: thread.user_id, username: thread.username, full_name: thread.full_name, avatar_url: thread.avatar_url },
        created_at: thread.created_at.toISOString(),
      },
      posts: posts.map((p) => ({
        id: p.id, title: p.title, content_markdown: p.content_markdown,
        like_count: p.like_count, position: p.thread_position,
        published_at: p.published_at?.toISOString() ?? null,
      })),
    });
  }
);

threadsRoutes.post(
  "/:id/posts",
  describeRoute({
    description: "Add a post to an existing thread",
    tags: ["threads"],
    responses: {
      201: { description: "Post added" },
      403: { description: "Not authorized" },
      404: { description: "Thread not found" },
    },
  }),
  validator("json", z.object({
    content_markdown: z.string().min(1).max(10000),
    title: z.string().max(200).optional(),
  })),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("threads");
    if (!enabled) return c.json({ error: "Threads feature is not enabled" }, 403);

    const user = c.get("user")!;
    const threadId = c.req.param("id");
    const body = c.req.valid("json");
    const db = getDb();
    const settings = await getInstanceSettings();

    const thread = await db.selectFrom("threads").select(["user_id"]).where("id", "=", threadId).executeTakeFirst();
    if (!thread) return c.json({ error: "Thread not found" }, 404);
    if (thread.user_id !== user.id) return c.json({ error: "Not authorized" }, 403);

    const maxPos = await db
      .selectFrom("posts")
      .select((eb) => eb.fn.max("thread_position").as("max_pos"))
      .where("thread_id", "=", threadId)
      .executeTakeFirst();

    const position = (Number(maxPos?.max_pos) || 0) + 1;
    const postId = generateId();
    const apObjectId = `https://${settings.instance_domain}/post/${postId}`;

    await db.insertInto("posts").values({
      id: postId,
      author_id: user.id,
      title: body.title ?? "",
      content_markdown: body.content_markdown,
      summary: null,
      hashtags: [],
      like_count: 0,
      visibility: "public",
      ap_object_id: apObjectId,
      thread_id: threadId,
      thread_position: position,
      published_at: new Date(),
    }).execute();

    return c.json({ id: postId, position }, 201);
  }
);
