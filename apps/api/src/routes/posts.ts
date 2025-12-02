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
import { getPostUrlSync } from "@xlog/ap";
import { renderMarkdown } from "@xlog/markdown";
import {
  sessionMiddleware,
  requireAuth,
} from "../middleware/session";

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
            schema: resolver(z.object({
              items: z.array(PostResponseSchema),
              nextCursor: z.string().optional(),
              hasMore: z.boolean(),
            })),
          },
        },
      },
    },
  }),
  validator("query", PaginationQuerySchema.extend({
    author: z.string().optional(),
  })),
  async (c) => {
    const { limit, cursor, author } = c.req.valid("query");
    const db = getDb();

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

    const response = items.map((post) => ({
      id: post.id,
      url: getPostUrlSync(post.id, settings.instance_domain),
      title: post.title,
      banner_url: post.banner_url,
      content_html: post.content_markdown, // TODO: Render markdown
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
    }));

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
  validator("param", z.object({
    id: z.string(),
  })),
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

    return c.json({
      id: post.id,
      url: getPostUrlSync(post.id, settings.instance_domain),
      title: post.title,
      banner_url: post.banner_url,
      content_html: contentHtml,
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
        content_blocks_json: data.content_blocks as any,
        summary: data.summary || null,
        hashtags: data.hashtags,
        visibility: data.visibility,
        ap_object_id: apObjectId,
        like_count: 0,
      })
      .execute();

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
  validator("param", z.object({
    id: z.string(),
  })),
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
      .select("author_id")
      .where("id", "=", id)
      .executeTakeFirst();

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (post.author_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db
      .updateTable("posts")
      .set({
        ...data,
        content_blocks_json: data.content_blocks
          ? (data.content_blocks as any)
          : undefined,
      })
      .where("id", "=", id)
      .execute();

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
  validator("param", z.object({
    id: z.string(),
  })),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const db = getDb();

    // Check authorization
    const post = await db
      .selectFrom("posts")
      .select("author_id")
      .where("id", "=", id)
      .executeTakeFirst();

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    if (post.author_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db.deleteFrom("posts").where("id", "=", id).execute();

    return c.json({ message: "Post deleted" });
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
  validator("param", z.object({
    id: z.string(),
  })),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.valid("param");
    const db = getDb();

    // Check authorization
    const post = await db
      .selectFrom("posts")
      .select("author_id")
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

    // TODO: Trigger federation delivery
    // This will be handled by the worker service

    return c.json({ message: "Post published" });
  }
);
