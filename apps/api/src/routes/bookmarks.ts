import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { getDb } from "@xlog/db";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { isFeatureEnabled } from "../lib/features";

const BookmarkCreateSchema = z.object({
  postId: z.string().min(1).optional(),
  url: z.string().url().optional(),
  title: z.string().max(500).optional(),
}).refine((data) => data.postId || data.url, {
  message: "Either postId or url is required",
});

export const bookmarksRoutes = new Hono().use("*", sessionMiddleware);

// ── GET /bookmarks ─────────────────────────────────────────────────

bookmarksRoutes.get(
  "/",
  describeRoute({
    description: "List current user's bookmarks",
    tags: ["bookmarks"],
    responses: {
      200: { description: "Bookmark list" },
      403: { description: "Feature disabled" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("bookmarks");
    if (!enabled) {
      return c.json({ error: "Bookmarks feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const db = getDb();

    const limit = Math.min(Number(c.req.query("limit") || 20), 100);
    const cursor = c.req.query("cursor");

    let query = db
      .selectFrom("bookmarks")
      .leftJoin("posts", "posts.id", "bookmarks.post_id")
      .leftJoin("users", "users.id", "posts.author_id")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "bookmarks.id",
        "bookmarks.post_id",
        "bookmarks.url",
        "bookmarks.post_title",
        "bookmarks.created_at",
        "posts.title as post_title_from_post",
        "posts.banner_url",
        "posts.summary",
        "posts.published_at",
        "posts.like_count",
        "posts.hashtags",
        "users.username as author_username",
        "user_profiles.full_name as author_full_name",
        "user_profiles.avatar_url as author_avatar_url",
      ])
      .where("bookmarks.user_id", "=", user.id)
      .orderBy("bookmarks.created_at", "desc")
      .limit(limit + 1);

    if (cursor) {
      query = query.where("bookmarks.created_at", "<", new Date(cursor));
    }

    const rows = await query.execute();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      post_id: row.post_id,
      url: row.url,
      title: row.post_title_from_post || row.post_title || row.url || "Untitled",
      banner_url: row.banner_url,
      summary: row.summary,
      published_at: row.published_at?.toISOString() ?? null,
      like_count: row.like_count ?? 0,
      hashtags: row.hashtags ?? [],
      author: row.author_username
        ? {
            username: row.author_username,
            full_name: row.author_full_name,
            avatar_url: row.author_avatar_url,
          }
        : null,
      created_at: row.created_at.toISOString(),
    }));

    return c.json({
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].created_at : undefined,
    });
  }
);

// ── POST /bookmarks ────────────────────────────────────────────────

bookmarksRoutes.post(
  "/",
  describeRoute({
    description: "Create a bookmark",
    tags: ["bookmarks"],
    responses: {
      201: { description: "Bookmark created" },
      403: { description: "Feature disabled" },
      409: { description: "Already bookmarked" },
    },
  }),
  validator("json", BookmarkCreateSchema),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("bookmarks");
    if (!enabled) {
      return c.json({ error: "Bookmarks feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const body = c.req.valid("json");
    const db = getDb();

    // Check for existing bookmark
    let existing;
    if (body.postId) {
      existing = await db
        .selectFrom("bookmarks")
        .select(["id"])
        .where("user_id", "=", user.id)
        .where("post_id", "=", body.postId)
        .executeTakeFirst();
    } else if (body.url) {
      existing = await db
        .selectFrom("bookmarks")
        .select(["id"])
        .where("user_id", "=", user.id)
        .where("url", "=", body.url)
        .executeTakeFirst();
    }

    if (existing) {
      return c.json({ error: "Already bookmarked", id: existing.id }, 409);
    }

    // Resolve post title if postId provided
    let postTitle: string | null = null;
    if (body.postId) {
      const post = await db
        .selectFrom("posts")
        .select(["title"])
        .where("id", "=", body.postId)
        .executeTakeFirst();
      if (!post) {
        return c.json({ error: "Post not found" }, 404);
      }
      postTitle = post.title;
    }

    const id = crypto.randomUUID();
    await db
      .insertInto("bookmarks")
      .values({
        id,
        user_id: user.id,
        post_id: body.postId ?? null,
        url: body.url ?? null,
        post_title: postTitle,
      })
      .execute();

    return c.json({ id, post_id: body.postId, url: body.url }, 201);
  }
);

// ── DELETE /bookmarks/:id ──────────────────────────────────────────

bookmarksRoutes.delete(
  "/:id",
  describeRoute({
    description: "Delete a bookmark by ID or by postId query param",
    tags: ["bookmarks"],
    responses: {
      200: { description: "Bookmark deleted" },
      403: { description: "Feature disabled" },
      404: { description: "Bookmark not found" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("bookmarks");
    if (!enabled) {
      return c.json({ error: "Bookmarks feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = getDb();

    const deleted = await db
      .deleteFrom("bookmarks")
      .where("id", "=", id)
      .where("user_id", "=", user.id)
      .executeTakeFirst();

    if (deleted.numDeletedRows === 0n) {
      return c.json({ error: "Bookmark not found" }, 404);
    }

    return c.json({ deleted: id });
  }
);

// ── DELETE /bookmarks/by-post/:postId ──────────────────────────────

bookmarksRoutes.delete(
  "/by-post/:postId",
  describeRoute({
    description: "Delete a bookmark by post ID",
    tags: ["bookmarks"],
    responses: {
      200: { description: "Bookmark deleted" },
      403: { description: "Feature disabled" },
      404: { description: "Bookmark not found" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("bookmarks");
    if (!enabled) {
      return c.json({ error: "Bookmarks feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const postId = c.req.param("postId");
    const db = getDb();

    const deleted = await db
      .deleteFrom("bookmarks")
      .where("post_id", "=", postId)
      .where("user_id", "=", user.id)
      .executeTakeFirst();

    if (deleted.numDeletedRows === 0n) {
      return c.json({ error: "Bookmark not found" }, 404);
    }

    return c.json({ deleted: postId });
  }
);

// ── GET /bookmarks/check/:postId ──────────────────────────────────

bookmarksRoutes.get(
  "/check/:postId",
  describeRoute({
    description: "Check if a post is bookmarked by the current user",
    tags: ["bookmarks"],
    responses: {
      200: { description: "Bookmark status" },
      403: { description: "Feature disabled" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("bookmarks");
    if (!enabled) {
      return c.json({ error: "Bookmarks feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const postId = c.req.param("postId");
    const db = getDb();

    const bookmark = await db
      .selectFrom("bookmarks")
      .select(["id"])
      .where("user_id", "=", user.id)
      .where("post_id", "=", postId)
      .executeTakeFirst();

    return c.json({
      bookmarked: !!bookmark,
      id: bookmark?.id ?? null,
    });
  }
);
