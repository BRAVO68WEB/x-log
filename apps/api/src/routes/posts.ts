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
import { generateId } from "@xlog/snowflake";
import {
  getPostUrlSync,
  getActorUrlSync,
  getFollowersUrlSync,
  createArticleObjectSync,
  createDeleteActivity,
  createLikeActivity,
  createUndoActivity,
} from "@xlog/ap";
import { renderMarkdown } from "@xlog/markdown";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { enqueueDeliveriesToFollowers } from "../lib/redis";

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

const EMPTY_CONTENT_BLOCKS = {
  type: "doc",
  content: [],
} satisfies Record<string, unknown>;

function extractImageUrls(doc: unknown): string[] {
  const urls: string[] = [];
  function walk(node: any) {
    if (!node) return;
    if (node.type === "image" && node.attrs?.src) {
      urls.push(node.attrs.src);
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
    }
  }
  walk(doc);
  return urls;
}

function extractMarkdownImageUrls(markdown?: string | null): string[] {
  if (!markdown) return [];

  const urls: string[] = [];
  const regex = /!\[[^\]]*\]\((https?:\/\/[^)\s]+(?:\s+"[^"]*")?)\)/g;

  for (const match of markdown.matchAll(regex)) {
    const rawUrl = match[1]?.trim();
    if (!rawUrl) continue;
    const cleanedUrl = rawUrl.split(/\s+"/)[0];
    urls.push(cleanedUrl);
  }

  return urls;
}

async function linkMediaToPost(
  db: ReturnType<typeof getDb>,
  postId: string,
  bannerUrl?: string | null,
  contentBlocks?: unknown,
  markdown?: string | null
) {
  try {
    if (bannerUrl) {
      await db
        .updateTable("media")
        .set({ post_id: postId, asset_type: "banner" })
        .where("url", "=", bannerUrl)
        .where("post_id", "is", null)
        .execute();
    }
    if (contentBlocks && typeof contentBlocks === "object") {
      const imageUrls = extractImageUrls(contentBlocks);
      for (const url of imageUrls) {
        await db
          .updateTable("media")
          .set({ post_id: postId })
          .where("url", "=", url)
          .where("post_id", "is", null)
          .execute();
      }
    }
    for (const url of extractMarkdownImageUrls(markdown)) {
      await db
        .updateTable("media")
        .set({ post_id: postId })
        .where("url", "=", url)
        .where("post_id", "is", null)
        .execute();
    }
  } catch (err) {
    console.error("Failed to link media to post:", err);
  }
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
    })
  ),
  async (c) => {
    const { limit, cursor, author } = c.req.valid("query");
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
        "posts.updated_at",
        "posts.visibility",
        "users.username",
        "user_profiles.full_name",
        "user_profiles.avatar_url",
      ])
      .where("posts.visibility", "=", "public")
      .where("posts.published_at", "is not", null)
      .orderBy("posts.published_at", "desc")
      .limit(limit + 1);

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
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const data = c.req.valid("json");
    const db = getDb();
    const settings = await getInstanceSettings();

    const postId = generateId();
    const apObjectId = `https://${settings.instance_domain}/post/${postId}`;

    await db
      .insertInto("posts")
      .values({
        id: postId,
        author_id: user.id,
        title: data.title,
        banner_url: data.banner_url || null,
        content_markdown: data.content_markdown,
        content_blocks_json: (data.content_blocks || EMPTY_CONTENT_BLOCKS) as any,
        summary: data.summary || null,
        hashtags: data.hashtags,
        visibility: data.visibility,
        ap_object_id: apObjectId,
        like_count: 0,
      })
      .execute();

    // Link uploaded media to this post
    await linkMediaToPost(db, postId, data.banner_url, data.content_blocks, data.content_markdown);

    const post = await db
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
        "posts.updated_at",
        "posts.visibility",
        "users.username",
        "user_profiles.full_name",
        "user_profiles.avatar_url",
      ])
      .where("posts.id", "=", postId)
      .executeTakeFirst();

    return c.json(
      {
        id: post!.id,
        url: getPostUrlSync(post!.id, settings.instance_domain),
        title: post!.title,
        banner_url: post!.banner_url,
        content_html: await renderMarkdown(post!.content_markdown),
        content_markdown: post!.content_markdown,
        hashtags: post!.hashtags,
        like_count: post!.like_count,
        author: {
          username: post!.username,
          full_name: post!.full_name || null,
          avatar_url: post!.avatar_url || null,
        },
        published_at: post!.published_at?.toISOString() || null,
        updated_at: post!.updated_at.toISOString(),
        visibility: post!.visibility,
      },
      201
    );
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
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const db = getDb();

    // Check authorization
    const post = await db
      .selectFrom("posts")
      .select(["author_id", "published_at", "visibility"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (post.author_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    const { content_blocks, ...postUpdateData } = data;

    await db
      .updateTable("posts")
      .set({
        ...postUpdateData,
        content_blocks_json:
          content_blocks !== undefined
            ? ((content_blocks || EMPTY_CONTENT_BLOCKS) as any)
            : undefined,
      })
      .where("id", "=", id)
      .execute();

    // Link uploaded media to this post
    await linkMediaToPost(db, id, data.banner_url, content_blocks, data.content_markdown);

    // Trigger federation Update if post is published and not private
    if (post.published_at && post.visibility !== "private") {
      try {
        const settings = await getInstanceSettings();
        if (settings.federation_enabled) {
          const activityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;
          await enqueueDeliveriesToFollowers(
            post.author_id,
            id,
            activityId,
            "Update",
            settings.instance_domain
          );
        }
      } catch (err) {
        console.error("Failed to enqueue Update deliveries:", err);
      }
    }

    return c.json({ message: "Post updated" });
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
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const db = getDb();

    // Check authorization
    const post = await db
      .selectFrom("posts")
      .innerJoin("users", "users.id", "posts.author_id")
      .select([
        "posts.author_id",
        "posts.published_at",
        "posts.visibility",
        "posts.ap_object_id",
        "users.username",
      ])
      .where("posts.id", "=", id)
      .executeTakeFirst();

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (post.author_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    // Build Delete activity before deleting the post from DB
    if (post.published_at && post.visibility !== "private" && post.ap_object_id) {
      try {
        const settings = await getInstanceSettings();
        if (settings.federation_enabled) {
          const actorId = getActorUrlSync(post.username, settings.instance_domain);
          const followersUrl = getFollowersUrlSync(post.username, settings.instance_domain);
          const activityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;
          const deleteActivity = createDeleteActivity(
            activityId,
            actorId,
            post.ap_object_id,
            followersUrl
          );
          await enqueueDeliveriesToFollowers(
            post.author_id,
            id,
            activityId,
            "Delete",
            settings.instance_domain,
            JSON.stringify(deleteActivity)
          );
        }
      } catch (err) {
        console.error("Failed to enqueue Delete deliveries:", err);
      }
    }

    await db.deleteFrom("posts").where("id", "=", id).execute();

    return c.json({ message: "Post deleted" });
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
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const db = getDb();

    // Check authorization
    const post = await db
      .selectFrom("posts")
      .select(["author_id", "visibility"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (post.author_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    const publishedAt = new Date();
    await db
      .updateTable("posts")
      .set({
        published_at: publishedAt,
      })
      .where("id", "=", id)
      .execute();

    // Trigger federation delivery
    if (post.visibility !== "private") {
      try {
        const settings = await getInstanceSettings();
        if (settings.federation_enabled) {
          const activityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;
          await enqueueDeliveriesToFollowers(
            post.author_id,
            id,
            activityId,
            "Create",
            settings.instance_domain
          );
        }
      } catch (err) {
        console.error("Failed to enqueue Create deliveries:", err);
      }
    }

    return c.json({ message: "Post published" });
  }
);
