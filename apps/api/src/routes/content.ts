import { Hono } from "hono";
import { getDb } from "@xlog/db";
import { sessionMiddleware } from "../middleware/session";
import { generateId } from "@xlog/snowflake";
import { z } from "zod";
import { isFeatureEnabledAsync, Feature } from "../lib/features";

export const contentRoutes = new Hono().use("*", sessionMiddleware);

// Validation schemas
const snippetSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  language: z.string().min(1),
  code: z.string().min(1),
  visibility: z.enum(["public", "followers", "private"]).default("public"),
  tags: z.array(z.string()).optional(),
  forkOf: z.string().optional(),
});

const linkSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  ogImage: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const postMetaSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

const bookmarkSchema = z.object({
  postId: z.string(),
});

// ============ SNIPPETS ============

// List snippets
contentRoutes.get("/snippets", async (c) => {
  const userId = c.get("user")?.id as string;
  const { limit = "20", cursor, language, visibility } = c.req.query();

  const db = getDb();
  const limitNum = parseInt(limit);
  const snippets = await db
    .selectFrom("snippets")
    .select([
      "id",
      "title",
      "description",
      "language",
      "visibility",
      "tags",
      "fork_of as forkOf",
      "current_version as currentVersion",
      "created_at as createdAt",
      "updated_at as updatedAt",
    ])
    .where((eb) => {
      const conditions = [];
      conditions.push(eb.or([eb("visibility", "=", "public"), eb("user_id", "=", userId)]));
      if (language) {
        conditions.push(eb("language", "=", language));
      }
      if (visibility && visibility !== "all") {
        conditions.push(eb("visibility", "=", visibility));
      }
      if (cursor) {
        conditions.push(eb("created_at", "<", new Date(cursor)));
      }
      return eb.and(conditions);
    })
    .orderBy("created_at", "desc")
    .limit(limitNum + 1)
    .execute();

  const hasMore = snippets.length > limitNum;
  const items = snippets.slice(0, limitNum);

  return c.json({
    items,
    hasMore,
    nextCursor: hasMore && items.length ? String(items[items.length - 1]?.createdAt) : null,
  });
});

// Get single snippet
contentRoutes.get("/snippets/:id", async (c) => {
  const { id } = c.req.param();
  const userId = c.get("user")?.id as string;

  const db = getDb();
  const snippet = await db
    .selectFrom("snippets")
    .select([
      "id",
      "title",
      "description",
      "language",
      "code",
      "visibility",
      "tags",
      "fork_of as forkOf",
      "current_version as currentVersion",
      "user_id as userId",
      "created_at as createdAt",
      "updated_at as updatedAt",
    ])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!snippet) {
    return c.json({ error: "Snippet not found" }, 404);
  }

  if (snippet.visibility !== "public" && snippet.userId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const versions = await db
    .selectFrom("snippet_versions")
    .select(["id", "version", "changelog", "created_at as createdAt"])
    .where("snippet_id", "=", id)
    .orderBy("version", "desc")
    .execute();

  return c.json({ snippet, versions });
});

// Create snippet
contentRoutes.post("/snippets", async (c) => {
  const userId = c.get("user")?.id as string;

  if (!(await isFeatureEnabledAsync(Feature.CODE_SNIPPETS))) {
    return c.json({ error: "Feature disabled" }, 403);
  }

  const body = await c.req.json();
  const result = snippetSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.message }, 400);
  }

  const data = result.data;
  const db = getDb();
  const id = generateId();
  const now = new Date();

  const snippetData = {
    id,
    title: data.title,
    description: data.description ?? null,
    user_id: userId,
    language: data.language,
    code: data.code,
    visibility: data.visibility,
    tags: JSON.stringify(data.tags ?? []),
    fork_of: data.forkOf ?? null,
    current_version: 1,
    updated_at: now,
  };
  await db.insertInto("snippets").values(snippetData).execute();

  const versionData = {
    id: generateId(),
    snippet_id: id,
    version: 1,
    code: data.code,
    changelog: "Initial version",
  };
  await db.insertInto("snippet_versions").values(versionData).execute();

  return c.json({ id }, 201);
});

// Update snippet
contentRoutes.put("/snippets/:id", async (c) => {
  const { id } = c.req.param();
  const userId = c.get("user")?.id as string;

  if (!(await isFeatureEnabledAsync(Feature.CODE_SNIPPETS))) {
    return c.json({ error: "Feature disabled" }, 403);
  }

  const db = getDb();
  const existing = await db
    .selectFrom("snippets")
    .select(["user_id as userId", "code", "current_version as currentVersion"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!existing) {
    return c.json({ error: "Snippet not found" }, 404);
  }
  if (existing.userId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const body = await c.req.json();
  const result = snippetSchema.partial().safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.message }, 400);
  }

  const data = result.data;
  const now = new Date();
  const newVersion = existing.currentVersion + 1;

  const updates: Record<string, unknown> = { updated_at: now };
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description;
  if (data.language !== undefined) updates.language = data.language;
  if (data.visibility !== undefined) updates.visibility = data.visibility;
  if (data.tags !== undefined) updates.tags = JSON.stringify(data.tags);
  if (data.code !== undefined) {
    updates.code = data.code;
    updates.current_version = newVersion;
    const versionData = {
      id: generateId(),
      snippet_id: id,
      version: newVersion,
      code: data.code,
      changelog: data.description ?? null,
    };
    await db.insertInto("snippet_versions").values(versionData).execute();
  }

  await db.updateTable("snippets").set(updates).where("id", "=", id).execute();

  return c.json({ id, version: newVersion });
});

// Delete snippet
contentRoutes.delete("/snippets/:id", async (c) => {
  const { id } = c.req.param();
  const userId = c.get("user")?.id as string;

  const db = getDb();
  const existing = await db
    .selectFrom("snippets")
    .select(["user_id as userId"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!existing) {
    return c.json({ error: "Snippet not found" }, 404);
  }
  if (existing.userId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  await db.deleteFrom("snippets").where("id", "=", id).execute();
  return c.json({ success: true });
});

// ============ LINKS ============

// List links
contentRoutes.get("/links", async (c) => {
  const userId = c.get("user")?.id as string;
  const { limit = "20", cursor, tag } = c.req.query();

  const db = getDb();
  const limitNum = parseInt(limit);

  const links = await db
    .selectFrom("links")
    .select([
      "id",
      "url",
      "title",
      "description",
      "thumbnail",
      "og_image as ogImage",
      "views",
      "tags",
      "archived_url as archivedUrl",
      "archived_at as archivedAt",
    ])
    .where((eb) => {
      const conditions = [eb.or([eb("is_public", "=", true), eb("user_id", "=", userId)])];
      if (cursor) {
        conditions.push(eb("archived_at", "<", new Date(cursor)));
      }
      return eb.and(conditions);
    })
    .orderBy("archived_at", "desc")
    .limit(limitNum + 1)
    .execute();

  let filtered = links;
  if (tag) {
    filtered = links.filter((l) => {
      const tags = JSON.parse(l.tags || "[]");
      return tags.includes(tag);
    });
  }

  const hasMore = filtered.length > limitNum;
  const items = filtered.slice(0, limitNum);

  return c.json({
    items,
    hasMore,
    nextCursor: hasMore && items.length ? String(items[items.length - 1]?.archivedAt) : null,
  });
});

// Get single link
contentRoutes.get("/links/:id", async (c) => {
  const { id } = c.req.param();

  const db = getDb();
  const link = await db
    .selectFrom("links")
    .select([
      "id",
      "url",
      "title",
      "description",
      "thumbnail",
      "og_image as ogImage",
      "views",
      "tags",
      "archived_url as archivedUrl",
      "archived_at as archivedAt",
    ])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!link) {
    return c.json({ error: "Link not found" }, 404);
  }

  await db
    .updateTable("links")
    .set({ views: link.views + 1 })
    .where("id", "=", id)
    .execute();

  return c.json(link);
});

// Create link
contentRoutes.post("/links", async (c) => {
  const userId = c.get("user")?.id as string;

  if (!(await isFeatureEnabledAsync(Feature.LINK_ARCHIVE))) {
    return c.json({ error: "Feature disabled" }, 403);
  }

  const body = await c.req.json();
  const result = linkSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.message }, 400);
  }

  const data = result.data;
  const db = getDb();

  const existing = await db
    .selectFrom("links")
    .select(["id"])
    .where("url", "=", data.url)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  if (existing) {
    return c.json({ id: existing.id, message: "Link already archived" }, 200);
  }

  const id = generateId();
  await db
    .insertInto("links")
    .values({
      id,
      url: data.url,
      title: data.title ?? null,
      description: data.description ?? null,
      thumbnail: data.thumbnail ?? null,
      og_image: data.ogImage ?? null,
      user_id: userId,
      views: 0,
      is_public: true,
      tags: JSON.stringify(data.tags ?? []),
    })
    .execute();

  return c.json({ id }, 201);
});

// Archive to Wayback Machine
contentRoutes.post("/links/:id/archive", async (c) => {
  const { id } = c.req.param();
  const userId = c.get("user")?.id as string;

  const db = getDb();
  const link = await db
    .selectFrom("links")
    .select(["id", "url", "user_id as userId"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!link) {
    return c.json({ error: "Link not found" }, 404);
  }
  if (link.userId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const archiveUrl = `https://web.archive.org/save/${encodeURIComponent(link.url)}`;

  await db.updateTable("links").set({ archived_url: archiveUrl }).where("id", "=", id).execute();

  return c.json({ archivedUrl: archiveUrl });
});

// Delete link
contentRoutes.delete("/links/:id", async (c) => {
  const { id } = c.req.param();
  const userId = c.get("user")?.id as string;

  const db = getDb();
  const existing = await db
    .selectFrom("links")
    .select(["user_id as userId"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!existing) {
    return c.json({ error: "Link not found" }, 404);
  }
  if (existing.userId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  await db.deleteFrom("links").where("id", "=", id).execute();
  return c.json({ success: true });
});

// ============ POST META ============

// Get post metadata
contentRoutes.get("/posts/:postId/meta", async (c) => {
  const { postId } = c.req.param();

  const db = getDb();
  const meta = await db
    .selectFrom("post_meta")
    .select(["key", "value"])
    .where("post_id", "=", postId)
    .execute();

  const result: Record<string, string> = {};
  for (const m of meta) {
    result[m.key] = m.value;
  }

  return c.json({ meta: result });
});

// Set post metadata
contentRoutes.post("/posts/:postId/meta", async (c) => {
  const { postId } = c.req.param();
  const userId = c.get("user")?.id as string;

  if (!(await isFeatureEnabledAsync(Feature.CUSTOM_POST_META))) {
    return c.json({ error: "Feature disabled" }, 403);
  }

  const body = await c.req.json();
  const result = postMetaSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.message }, 400);
  }

  const { key, value } = result.data;
  const db = getDb();

  const post = await db
    .selectFrom("posts")
    .select(["author_id as authorId"])
    .where("id", "=", postId)
    .executeTakeFirst();

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }
  if (post.authorId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  await db
    .insertInto("post_meta")
    .values({
      id: generateId(),
      post_id: postId,
      key,
      value,
      updated_at: new Date(),
    })
    .onConflict((oc) =>
      oc.columns(["post_id", "key"]).doUpdateSet({
        value,
        updated_at: new Date(),
      })
    )
    .execute();

  return c.json({ key, value });
});

// Delete post metadata
contentRoutes.delete("/posts/:postId/meta/:key", async (c) => {
  const { postId, key } = c.req.param();
  const userId = c.get("user")?.id as string;

  const db = getDb();
  const post = await db
    .selectFrom("posts")
    .select(["author_id as authorId"])
    .where("id", "=", postId)
    .executeTakeFirst();

  if (!post) {
    return c.json({ error: "Post not found" }, 404);
  }
  if (post.authorId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  await db.deleteFrom("post_meta").where("post_id", "=", postId).where("key", "=", key).execute();
  return c.json({ success: true });
});

// ============ BOOKMARKS ============

// List bookmarks
contentRoutes.get("/bookmarks", async (c) => {
  const userId = c.get("user")?.id as string;
  const { limit = "20", cursor } = c.req.query();

  const db = getDb();
  const limitNum = parseInt(limit);

  const bookmarks = await db
    .selectFrom("bookmarks")
    .innerJoin("posts", "posts.id", "bookmarks.post_id")
    .select(["bookmarks.id", "bookmarks.post_id as postId", "bookmarks.created_at as createdAt"])
    .select([
      "posts.title",
      "posts.content_markdown as contentMarkdown",
      "posts.banner_url as bannerUrl",
      "posts.published_at as publishedAt",
    ])
    .where("bookmarks.user_id", "=", userId)
    .orderBy("bookmarks.created_at", "desc")
    .limit(limitNum + 1)
    .execute();

  const hasMore = bookmarks.length > limitNum;
  const items = bookmarks.slice(0, limitNum);

  return c.json({
    items,
    hasMore,
    nextCursor: hasMore && items.length ? String(items[items.length - 1]?.createdAt) : null,
  });
});

// Add bookmark
contentRoutes.post("/bookmarks", async (c) => {
  const userId = c.get("user")?.id as string;

  if (!(await isFeatureEnabledAsync(Feature.BOOKMARKS))) {
    return c.json({ error: "Feature disabled" }, 403);
  }

  const body = await c.req.json();
  const result = bookmarkSchema.safeParse(body);
  if (!result.success) {
    return c.json({ error: result.error.message }, 400);
  }

  const { postId } = result.data;
  const db = getDb();

  const existing = await db
    .selectFrom("bookmarks")
    .select(["id"])
    .where("user_id", "=", userId)
    .where("post_id", "=", postId)
    .executeTakeFirst();

  if (existing) {
    return c.json({ id: existing.id, message: "Already bookmarked" }, 200);
  }

  const id = generateId();
  const insertData = {
    id,
    user_id: userId,
    post_id: postId,
  };
  await db.insertInto("bookmarks").values(insertData).execute();

  return c.json({ id }, 201);
});

// Remove bookmark
contentRoutes.delete("/bookmarks/:postId", async (c) => {
  const { postId } = c.req.param();
  const userId = c.get("user")?.id as string;

  const db = getDb();
  await db
    .deleteFrom("bookmarks")
    .where("user_id", "=", userId)
    .where("post_id", "=", postId)
    .execute();
  return c.json({ success: true });
});

// Check if post is bookmarked
contentRoutes.get("/bookmarks/:postId", async (c) => {
  const { postId } = c.req.param();
  const userId = c.get("user")?.id as string;

  const db = getDb();
  const bookmark = await db
    .selectFrom("bookmarks")
    .select(["id"])
    .where("user_id", "=", userId)
    .where("post_id", "=", postId)
    .executeTakeFirst();

  return c.json({ bookmarked: !!bookmark });
});
