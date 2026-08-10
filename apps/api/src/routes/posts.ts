import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import {
  PostCreateSchema,
  PostUpdateSchema,
  PostResponseSchema,
  PaginationQuerySchema,
} from "@xlog/validation";
import { getDb, getInstanceSettings } from "@xlog/db";
import {
  getPostUrlSync,
  getActorUrlSync,
  createLikeActivity,
  createUndoActivity,
} from "@xlog/ap";
import { renderMarkdown } from "@xlog/markdown";
import { sessionMiddleware, requireAuth, requireAuthor } from "../middleware/session";
import { enqueueDeliveriesToFollowers } from "../lib/redis";
import {
  createPost,
  updatePost,
  publishPost,
  schedulePost,
  unschedulePost,
  deletePost,
  PostServiceError,
} from "../services/posts";
import { isFeatureEnabled } from "../lib/features";

async function getLikedPostIds(
  postIds: string[],
  user: { username: string } | undefined,
  domain: string
): Promise<Set<string>> {
  if (!user || postIds.length === 0) return new Set();
  const actor = getActorUrlSync(user.username, domain);
  const db = getDb();
  const rows = await db
    .selectFrom("post_likes")
    .select("post_id")
    .where("actor", "=", actor)
    .where("post_id", "in", postIds)
    .execute();
  return new Set(rows.map((row) => row.post_id));
}

async function getPostLikeState(
  postId: string,
  user: { username: string } | undefined,
  domain: string
) {
  if (!user) return false;
  const actor = getActorUrlSync(user.username, domain);
  const db = getDb();
  const like = await db
    .selectFrom("post_likes")
    .select("id")
    .where("post_id", "=", postId)
    .where("actor", "=", actor)
    .executeTakeFirst();
  return Boolean(like);
}

async function fetchPostLikeCount(postId: string) {
  const db = getDb();
  const row = await db
    .selectFrom("posts")
    .select("like_count")
    .where("id", "=", postId)
    .executeTakeFirst();
  return row?.like_count ?? 0;
}

export const postsRoutes = new Hono().use("*", sessionMiddleware);

postsRoutes.get(
  "/",
  describeRoute({
    description: "List posts",
    tags: ["posts"],
    responses: {
      200: {
        description: "List of posts",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                items: z.array(PostResponseSchema),
                nextCursor: z.string().optional(),
                hasMore: z.boolean(),
              })
            ),
          },
        },
      },
    },
  }),
  validator(
    "query",
    PaginationQuerySchema.extend({
      author: z.string().optional(),
      mine: z.string().optional(),
    })
  ),
  async (c) => {
    const { limit, cursor, author, mine } = c.req.valid("query");
    const db = getDb();
    const user = c.get("user");

    let query = db
      .selectFrom("posts")
      .innerJoin("users", "users.id", "posts.author_id")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "posts.id",
        "posts.title",
        "posts.banner_url",
        "posts.content_markdown",
        "posts.hashtags",
        "posts.like_count",
        "posts.published_at",
        "posts.scheduled_at",
        "posts.updated_at",
        "posts.visibility",
        "posts.author_id",
        "users.username",
        "user_profiles.full_name",
        "user_profiles.avatar_url",
      ]);

    if (mine === "true" && user) {
      // Show all of the authenticated user's posts (including drafts)
      query = query.where("posts.author_id", "=", user.id);
    } else {
      // Public feed: only published public posts
      query = query
        .where("posts.visibility", "=", "public")
        .where("posts.published_at", "is not", null);
    }

    query = query.orderBy("posts.updated_at", "desc").limit(limit + 1);

    if (author) {
      query = query.where("users.username", "=", author);
    }

    if (cursor) {
      query = query.where("posts.id", "<", cursor);
    }

    const posts = await query.execute();

    const hasMore = posts.length > limit;
    const items = posts.slice(0, limit);
    const settings = await getInstanceSettings();
    const likedPostIds = await getLikedPostIds(
      items.map((post) => post.id),
      user,
      settings.instance_domain
    );

    const response = await Promise.all(
      items.map(async (post) => ({
        id: post.id,
        url: getPostUrlSync(post.id, settings.instance_domain),
        title: post.title,
        banner_url: post.banner_url,
        content_html: await renderMarkdown(post.content_markdown),
        content_markdown: post.content_markdown,
        hashtags: post.hashtags,
        like_count: post.like_count,
        liked_by_me: likedPostIds.has(post.id),
        author: {
          username: post.username,
          full_name: post.full_name || null,
          avatar_url: post.avatar_url || null,
        },
        published_at: post.published_at?.toISOString() || null,
        scheduled_at: (post as { scheduled_at?: Date | null }).scheduled_at
          ? new Date((post as { scheduled_at: Date }).scheduled_at).toISOString()
          : null,
        updated_at: post.updated_at.toISOString(),
        visibility: post.visibility,
      }))
    );

    return c.json({
      items: response,
      nextCursor: hasMore ? items[items.length - 1].id : undefined,
      hasMore,
    });
  }
);

postsRoutes.get(
  "/:id",
  describeRoute({
    description: "Get post by ID",
    tags: ["posts"],
    responses: {
      200: {
        description: "Post",
        content: {
          "application/json": {
            schema: resolver(PostResponseSchema),
          },
        },
      },
      404: {
        description: "Post not found",
      },
    },
  }),
  validator(
    "param",
    z.object({
      id: z.string(),
    })
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb();
    const user = c.get("user"); // Optional - may be undefined for public access

    const post = await db
      .selectFrom("posts")
      .innerJoin("users", "users.id", "posts.author_id")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "posts.id",
        "posts.title",
        "posts.banner_url",
        "posts.content_markdown",
        "posts.content_blocks_json",
        "posts.summary",
        "posts.hashtags",
        "posts.like_count",
        "posts.published_at",
        "posts.updated_at",
        "posts.visibility",
        "posts.author_id",
        "users.username",
        "user_profiles.full_name",
        "user_profiles.avatar_url",
      ])
      .where("posts.id", "=", id)
      .executeTakeFirst();

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    // Unpublished posts (drafts) are only visible to the author or admins
    if (!post.published_at) {
      if (!user || (user.id !== post.author_id && user.role !== "admin")) {
        return c.json({ error: "Post not found" }, 404);
      }
    }

    // Check visibility: public and unlisted posts are visible to everyone
    // Private posts are only visible to the author or admins
    if (post.visibility === "private") {
      if (!user || (user.id !== post.author_id && user.role !== "admin")) {
        return c.json({ error: "Post not found" }, 404);
      }
    }

    const contentHtml = await renderMarkdown(post.content_markdown);
    const settings = await getInstanceSettings();
    const likedByMe = await getPostLikeState(post.id, user, settings.instance_domain);

    return c.json({
      id: post.id,
      url: getPostUrlSync(post.id, settings.instance_domain),
      title: post.title,
      banner_url: post.banner_url,
      content_html: contentHtml,
      content_markdown: post.content_markdown,
      content_blocks_json: post.content_blocks_json || null,
      summary: post.summary || null,
      author_id: post.author_id,
      hashtags: post.hashtags,
      like_count: post.like_count,
      liked_by_me: likedByMe,
      author: {
        username: post.username,
        full_name: post.full_name || null,
        avatar_url: post.avatar_url || null,
      },
      published_at: post.published_at?.toISOString() || null,
      updated_at: post.updated_at.toISOString(),
      visibility: post.visibility,
    });
  }
);

postsRoutes.post(
  "/",
  describeRoute({
    description: "Create a new post",
    tags: ["posts"],
    responses: {
      201: {
        description: "Post created",
        content: {
          "application/json": {
            schema: resolver(PostResponseSchema),
          },
        },
      },
    },
  }),
  validator("json", PostCreateSchema),
  requireAuthor,
  async (c) => {
    const user = c.get("user")!;
    const data = c.req.valid("json");
    const settings = await getInstanceSettings();

    try {
      const post = await createPost(
        { id: user.id, username: user.username, role: user.role },
        data
      );

      return c.json(
        {
          id: post.id,
          url: getPostUrlSync(post.id, settings.instance_domain),
          title: post.title,
          banner_url: post.banner_url,
          content_html: await renderMarkdown(post.content_markdown),
          content_markdown: post.content_markdown,
          hashtags: post.hashtags,
          like_count: post.like_count,
          author: {
            username: post.username,
            full_name: post.full_name || null,
            avatar_url: post.avatar_url || null,
          },
          published_at: post.published_at?.toISOString() || null,
          updated_at: post.updated_at.toISOString(),
          visibility: post.visibility,
        },
        201
      );
    } catch (err) {
      if (err instanceof PostServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      throw err;
    }
  }
);

postsRoutes.patch(
  "/:id",
  describeRoute({
    description: "Update a post",
    tags: ["posts"],
    responses: {
      200: {
        description: "Post updated",
      },
    },
  }),
  validator(
    "param",
    z.object({
      id: z.string(),
    })
  ),
  validator("json", PostUpdateSchema),
  requireAuthor,
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");

    try {
      await updatePost({ id: user.id, username: user.username, role: user.role }, id, data);
      return c.json({ message: "Post updated" });
    } catch (err) {
      if (err instanceof PostServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      throw err;
    }
  }
);

postsRoutes.delete(
  "/:id",
  describeRoute({
    description: "Delete a post",
    tags: ["posts"],
    responses: {
      200: {
        description: "Post deleted",
      },
    },
  }),
  validator(
    "param",
    z.object({
      id: z.string(),
    })
  ),
  requireAuthor,
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");

    try {
      await deletePost({ id: user.id, username: user.username, role: user.role }, id);
      return c.json({ message: "Post deleted" });
    } catch (err) {
      if (err instanceof PostServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      throw err;
    }
  }
);

postsRoutes.post(
  "/:id/like",
  describeRoute({
    description: "Like a post",
    tags: ["posts"],
    responses: {
      200: {
        description: "Post liked",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                liked_by_me: z.boolean(),
                like_count: z.number().int(),
              })
            ),
          },
        },
      },
    },
  }),
  validator("param", z.object({ id: z.string() })),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const db = getDb();

    const post = await db
      .selectFrom("posts")
      .innerJoin("users", "users.id", "posts.author_id")
      .select([
        "posts.id",
        "posts.author_id",
        "posts.visibility",
        "posts.published_at",
        "posts.ap_object_id",
        "users.username as author_username",
      ])
      .where("posts.id", "=", id)
      .executeTakeFirst();

    if (!post) return c.json({ error: "Post not found" }, 404);
    if (post.visibility === "private" && post.author_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Post not found" }, 404);
    }

    const settings = await getInstanceSettings();
    const actorId = getActorUrlSync(user.username, settings.instance_domain);
    const activityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;

    const existing = await db
      .selectFrom("post_likes")
      .select("id")
      .where("post_id", "=", id)
      .where("actor", "=", actorId)
      .executeTakeFirst();

    if (!existing) {
      await db
        .insertInto("post_likes")
        .values({
          id: crypto.randomUUID(),
          post_id: id,
          user_id: user.id,
          actor: actorId,
          activity_id: activityId,
        })
        .execute();

      await db
        .updateTable("posts")
        .set((eb) => ({ like_count: eb("like_count", "+", 1) }))
        .where("id", "=", id)
        .execute();

      if (settings.federation_enabled && post.visibility !== "private" && post.published_at) {
        const likeActivity = createLikeActivity(activityId, actorId, post.ap_object_id);
        await enqueueDeliveriesToFollowers(
          user.id,
          id,
          activityId,
          "Like",
          settings.instance_domain,
          JSON.stringify(likeActivity)
        );
      }

      try {
        const { createNotification } = await import("../lib/notifications");
        void createNotification({
          userId: post.author_id,
          type: "like",
          actorLabel: `@${user.username}`,
          actorUrl: actorId,
          postId: id,
          body: "liked your post",
          actorUserId: user.id,
        });
      } catch {
        /* ignore */
      }
    }

    return c.json({
      liked_by_me: true,
      like_count: await fetchPostLikeCount(id),
    });
  }
);

postsRoutes.delete(
  "/:id/like",
  describeRoute({
    description: "Unlike a post",
    tags: ["posts"],
    responses: {
      200: {
        description: "Post unliked",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                liked_by_me: z.boolean(),
                like_count: z.number().int(),
              })
            ),
          },
        },
      },
    },
  }),
  validator("param", z.object({ id: z.string() })),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const db = getDb();

    const post = await db
      .selectFrom("posts")
      .select(["id", "author_id", "visibility", "published_at", "ap_object_id"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!post) return c.json({ error: "Post not found" }, 404);
    if (post.visibility === "private" && post.author_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Post not found" }, 404);
    }

    const settings = await getInstanceSettings();
    const actorId = getActorUrlSync(user.username, settings.instance_domain);
    const existing = await db
      .selectFrom("post_likes")
      .select(["id", "activity_id"])
      .where("post_id", "=", id)
      .where("actor", "=", actorId)
      .executeTakeFirst();

    if (existing) {
      await db.deleteFrom("post_likes").where("id", "=", existing.id).execute();

      await db
        .updateTable("posts")
        .set((eb) => ({ like_count: eb("like_count", "-", 1) }))
        .where("id", "=", id)
        .where("like_count", ">", 0)
        .execute();

      if (settings.federation_enabled && post.visibility !== "private" && post.published_at) {
        const likeActivity = createLikeActivity(existing.activity_id, actorId, post.ap_object_id);
        const undoActivityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;
        const undoActivity = createUndoActivity(undoActivityId, actorId, likeActivity);
        await enqueueDeliveriesToFollowers(
          user.id,
          id,
          undoActivityId,
          "Undo",
          settings.instance_domain,
          JSON.stringify(undoActivity)
        );
      }
    }

    return c.json({
      liked_by_me: false,
      like_count: await fetchPostLikeCount(id),
    });
  }
);

postsRoutes.post(
  "/:id/publish",
  describeRoute({
    description: "Publish a post",
    tags: ["posts"],
    responses: {
      200: {
        description: "Post published",
      },
    },
  }),
  validator(
    "param",
    z.object({
      id: z.string(),
    })
  ),
  requireAuthor,
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");

    try {
      await publishPost({ id: user.id, username: user.username, role: user.role }, id);
      return c.json({ message: "Post published" });
    } catch (err) {
      if (err instanceof PostServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      throw err;
    }
  }
);

postsRoutes.post(
  "/:id/schedule",
  requireAuthor,
  validator("param", z.object({ id: z.string() })),
  validator(
    "json",
    z.object({
      scheduled_at: z.string().datetime({ offset: true }).or(z.string().min(1)),
    })
  ),
  async (c) => {
    if (!(await isFeatureEnabled("scheduled_posts"))) {
      return c.json({ error: "Scheduled posts feature is disabled" }, 404);
    }
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const when = new Date(body.scheduled_at);
    if (Number.isNaN(when.getTime())) {
      return c.json({ error: "Invalid scheduled_at" }, 400);
    }
    try {
      const result = await schedulePost(
        { id: user.id, username: user.username, role: user.role },
        id,
        when
      );
      return c.json(result);
    } catch (err) {
      if (err instanceof PostServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      throw err;
    }
  }
);

postsRoutes.delete(
  "/:id/schedule",
  requireAuthor,
  validator("param", z.object({ id: z.string() })),
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    try {
      const result = await unschedulePost(
        { id: user.id, username: user.username, role: user.role },
        id
      );
      return c.json(result);
    } catch (err) {
      if (err instanceof PostServiceError) {
        return c.json({ error: err.message }, err.status);
      }
      throw err;
    }
  }
);

postsRoutes.post(
  "/import",
  requireAuthor,
  validator(
    "json",
    z.object({
      posts: z
        .array(
          z.object({
            title: z.string().min(1).max(200),
            content_markdown: z.string().min(1),
            summary: z.string().optional().nullable(),
            hashtags: z.array(z.string()).max(20).optional(),
            visibility: z.enum(["public", "unlisted", "private"]).optional(),
            published: z.boolean().optional(),
          })
        )
        .min(1)
        .max(50),
    })
  ),
  async (c) => {
    const user = c.get("user")!;
    const body = c.req.valid("json");
    const actor = { id: user.id, username: user.username, role: user.role };
    const created: Array<{ id: string; title: string; published: boolean }> = [];

    for (const item of body.posts) {
      try {
        const post = await createPost(actor, {
          title: item.title,
          content_markdown: item.content_markdown,
          summary: item.summary || null,
          hashtags: (item.hashtags || [])
            .map((t) => t.replace(/^#/, "").toLowerCase())
            .filter((t) => /^[a-z0-9_]{1,64}$/i.test(t)),
          visibility: item.visibility || "public",
        });
        if (item.published) {
          await publishPost(actor, post.id);
        }
        created.push({
          id: post.id,
          title: item.title,
          published: Boolean(item.published),
        });
      } catch (err) {
        console.error("[import] failed for", item.title, err);
      }
    }

    return c.json(
      {
        imported: created.length,
        items: created,
      },
      201
    );
  }
);
