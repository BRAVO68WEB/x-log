import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import {
  PostMetaCreateSchema,
  PostMetaBulkUpdateSchema,
  PostMetaResponseSchema,
} from "@xlog/validation";
import { getDb } from "@xlog/db";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { isFeatureEnabled } from "../lib/features";

async function assertPostOwnership(
  postId: string,
  userId: string,
  userRole: string
): Promise<boolean> {
  const db = getDb();
  const post = await db
    .selectFrom("posts")
    .select(["author_id"])
    .where("id", "=", postId)
    .executeTakeFirst();

  if (!post) return false;
  if (userRole === "admin") return true;
  return post.author_id === userId;
}

export const postMetaRoutes = new Hono().use("*", sessionMiddleware);

// ── GET /posts/:id/meta ────────────────────────────────────────────

postMetaRoutes.get(
  "/:id/meta",
  describeRoute({
    description: "Get all metadata for a post",
    tags: ["post-meta"],
    responses: {
      200: {
        description: "Post metadata",
        content: {
          "application/json": {
            schema: resolver(PostMetaResponseSchema),
          },
        },
      },
      403: { description: "Feature disabled or not authorized" },
      404: { description: "Post not found" },
    },
  }),
  async (c) => {
    const enabled = await isFeatureEnabled("custom_post_meta");
    if (!enabled) {
      return c.json({ error: "Custom post metadata is not enabled" }, 403);
    }

    const postId = c.req.param("id");
    const db = getDb();

    const post = await db
      .selectFrom("posts")
      .select(["id", "author_id", "visibility"])
      .where("id", "=", postId)
      .executeTakeFirst();

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    // Public/unlisted meta is readable by anyone; private only by author
    const user = c.get("user");
    if (post.visibility === "private") {
      if (!user || (user.id !== post.author_id && user.role !== "admin")) {
        return c.json({ error: "Not authorized" }, 403);
      }
    }

    const rows = await db
      .selectFrom("post_meta")
      .select(["key", "value"])
      .where("post_id", "=", postId)
      .execute();

    const meta: Record<string, string> = {};
    for (const row of rows) {
      meta[row.key] = row.value;
    }

    return c.json({ meta });
  }
);

// ── POST /posts/:id/meta ───────────────────────────────────────────

postMetaRoutes.post(
  "/:id/meta",
  describeRoute({
    description: "Add or update a single metadata key for a post",
    tags: ["post-meta"],
    responses: {
      200: { description: "Metadata set" },
      403: { description: "Feature disabled or not authorized" },
      404: { description: "Post not found" },
    },
  }),
  validator("json", PostMetaCreateSchema),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("custom_post_meta");
    if (!enabled) {
      return c.json({ error: "Custom post metadata is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const postId = c.req.param("id");

    if (!(await assertPostOwnership(postId, user.id, user.role))) {
      return c.json({ error: "Post not found or not authorized" }, 404);
    }

    const { key, value } = c.req.valid("json");
    const db = getDb();

    // Upsert: insert or update on conflict
    await db
      .insertInto("post_meta")
      .values({
        id: crypto.randomUUID(),
        post_id: postId,
        key,
        value,
      })
      .onConflict((oc) =>
        oc.columns(["post_id", "key"]).doUpdateSet({
          value,
          updated_at: new Date(),
        })
      )
      .execute();

    return c.json({ key, value });
  }
);

// ── PUT /posts/:id/meta ────────────────────────────────────────────

postMetaRoutes.put(
  "/:id/meta",
  describeRoute({
    description: "Bulk replace all metadata for a post",
    tags: ["post-meta"],
    responses: {
      200: {
        description: "Metadata replaced",
        content: {
          "application/json": {
            schema: resolver(PostMetaResponseSchema),
          },
        },
      },
      403: { description: "Feature disabled or not authorized" },
      404: { description: "Post not found" },
    },
  }),
  validator("json", PostMetaBulkUpdateSchema),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("custom_post_meta");
    if (!enabled) {
      return c.json({ error: "Custom post metadata is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const postId = c.req.param("id");

    if (!(await assertPostOwnership(postId, user.id, user.role))) {
      return c.json({ error: "Post not found or not authorized" }, 404);
    }

    const { meta } = c.req.valid("json");
    const db = getDb();

    // Delete existing, then insert new
    await db.deleteFrom("post_meta").where("post_id", "=", postId).execute();

    const entries = Object.entries(meta);
    if (entries.length > 0) {
      await db
        .insertInto("post_meta")
        .values(
          entries.map(([key, value]) => ({
            id: crypto.randomUUID(),
            post_id: postId,
            key,
            value,
          }))
        )
        .execute();
    }

    return c.json({ meta });
  }
);

// ── DELETE /posts/:id/meta/:key ────────────────────────────────────

postMetaRoutes.delete(
  "/:id/meta/:key",
  describeRoute({
    description: "Remove a specific metadata key from a post",
    tags: ["post-meta"],
    responses: {
      200: { description: "Key deleted" },
      403: { description: "Feature disabled or not authorized" },
      404: { description: "Post or key not found" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("custom_post_meta");
    if (!enabled) {
      return c.json({ error: "Custom post metadata is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const postId = c.req.param("id");
    const key = c.req.param("key");

    if (!(await assertPostOwnership(postId, user.id, user.role))) {
      return c.json({ error: "Post not found or not authorized" }, 404);
    }

    const db = getDb();
    const deleted = await db
      .deleteFrom("post_meta")
      .where("post_id", "=", postId)
      .where("key", "=", key)
      .executeTakeFirst();

    if (deleted.numDeletedRows === 0n) {
      return c.json({ error: "Key not found" }, 404);
    }

    return c.json({ deleted: key });
  }
);
