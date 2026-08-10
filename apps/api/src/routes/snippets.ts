import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import {
  SnippetCreateSchema,
  SnippetUpdateSchema,
  SnippetResponseSchema,
  SnippetVersionSchema,
  PaginationQuerySchema,
} from "@xlog/validation";
import { getDb } from "@xlog/db";
import { generateId } from "@xlog/snowflake";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { isFeatureEnabled } from "../lib/features";

function mapSnippetRow(row: any, user?: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    language: row.language,
    code: row.code,
    visibility: row.visibility,
    current_version: row.current_version,
    fork_of: row.fork_of,
    tags: row.tags ?? [],
    view_count: row.view_count,
    user: user
      ? {
          id: row.user_id,
          username: user.username,
          full_name: user.full_name ?? null,
          avatar_url: user.avatar_url ?? null,
        }
      : { id: row.user_id, username: "unknown", full_name: null, avatar_url: null },
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

export const snippetsRoutes = new Hono().use("*", sessionMiddleware);

// ── GET /snippets ──────────────────────────────────────────────────

snippetsRoutes.get(
  "/",
  describeRoute({
    description: "List public snippets",
    tags: ["snippets"],
    responses: {
      200: { description: "Snippet list" },
      403: { description: "Feature disabled" },
    },
  }),
  async (c) => {
    const enabled = await isFeatureEnabled("code_snippets");
    if (!enabled) {
      return c.json({ error: "Code snippets feature is not enabled" }, 403);
    }

    const db = getDb();
    const limit = Math.min(Number(c.req.query("limit") || 20), 100);
    const cursor = c.req.query("cursor");
    const language = c.req.query("language");
    const tag = c.req.query("tag");
    const userId = c.req.query("user_id");

    let query = db
      .selectFrom("snippets")
      .leftJoin("users", "users.id", "snippets.user_id")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "snippets.id",
        "snippets.title",
        "snippets.description",
        "snippets.language",
        "snippets.code",
        "snippets.visibility",
        "snippets.current_version",
        "snippets.fork_of",
        "snippets.tags",
        "snippets.view_count",
        "snippets.user_id",
        "snippets.created_at",
        "snippets.updated_at",
        "users.username",
        "user_profiles.full_name",
        "user_profiles.avatar_url",
      ])
      .where("snippets.visibility", "=", "public")
      .orderBy("snippets.created_at", "desc")
      .limit(limit + 1);

    if (cursor) {
      query = query.where("snippets.created_at", "<", new Date(cursor));
    }
    if (language) {
      query = query.where("snippets.language", "=", language);
    }
    if (userId) {
      query = query.where("snippets.user_id", "=", userId);
    }

    const rows = await query.execute();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) =>
      mapSnippetRow(row, {
        username: row.username,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
      })
    );

    return c.json({
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].created_at : undefined,
    });
  }
);

// ── GET /snippets/:id ──────────────────────────────────────────────

snippetsRoutes.get(
  "/:id",
  describeRoute({
    description: "Get a snippet by ID",
    tags: ["snippets"],
    responses: {
      200: { description: "Snippet with versions" },
      403: { description: "Feature disabled" },
      404: { description: "Snippet not found" },
    },
  }),
  async (c) => {
    const enabled = await isFeatureEnabled("code_snippets");
    if (!enabled) {
      return c.json({ error: "Code snippets feature is not enabled" }, 403);
    }

    const id = c.req.param("id");
    const db = getDb();

    const snippet = await db
      .selectFrom("snippets")
      .leftJoin("users", "users.id", "snippets.user_id")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select([
        "snippets.id",
        "snippets.title",
        "snippets.description",
        "snippets.language",
        "snippets.code",
        "snippets.visibility",
        "snippets.current_version",
        "snippets.fork_of",
        "snippets.tags",
        "snippets.view_count",
        "snippets.user_id",
        "snippets.created_at",
        "snippets.updated_at",
        "users.username",
        "user_profiles.full_name",
        "user_profiles.avatar_url",
      ])
      .where("snippets.id", "=", id)
      .executeTakeFirst();

    if (!snippet) {
      return c.json({ error: "Snippet not found" }, 404);
    }

    // Private snippets only visible to owner
    const user = c.get("user");
    if (snippet.visibility === "private") {
      if (!user || (user.id !== snippet.user_id && user.role !== "admin")) {
        return c.json({ error: "Snippet not found" }, 404);
      }
    }

    // Increment view count
    await db
      .updateTable("snippets")
      .set({ view_count: snippet.view_count + 1 })
      .where("id", "=", id)
      .execute();

    // Fetch versions
    const versions = await db
      .selectFrom("snippet_versions")
      .select(["id", "version", "code", "changelog", "created_at"])
      .where("snippet_id", "=", id)
      .orderBy("version", "desc")
      .execute();

    return c.json({
      snippet: mapSnippetRow(snippet, {
        username: snippet.username,
        full_name: snippet.full_name,
        avatar_url: snippet.avatar_url,
      }),
      versions: versions.map((v) => ({
        ...v,
        created_at: v.created_at.toISOString(),
      })),
    });
  }
);

// ── POST /snippets ─────────────────────────────────────────────────

snippetsRoutes.post(
  "/",
  describeRoute({
    description: "Create a new snippet",
    tags: ["snippets"],
    responses: {
      201: { description: "Snippet created" },
      403: { description: "Feature disabled" },
    },
  }),
  validator("json", SnippetCreateSchema),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("code_snippets");
    if (!enabled) {
      return c.json({ error: "Code snippets feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const body = c.req.valid("json");
    const db = getDb();
    const id = generateId();

    await db
      .insertInto("snippets")
      .values({
        id,
        title: body.title,
        description: body.description ?? null,
        user_id: user.id,
        language: body.language,
        code: body.code,
        visibility: body.visibility,
        tags: body.tags,
      })
      .execute();

    // Create initial version
    await db
      .insertInto("snippet_versions")
      .values({
        id: crypto.randomUUID(),
        snippet_id: id,
        version: 1,
        code: body.code,
        changelog: "Initial version",
      })
      .execute();

    return c.json({ id }, 201);
  }
);

// ── PUT /snippets/:id ──────────────────────────────────────────────

snippetsRoutes.put(
  "/:id",
  describeRoute({
    description: "Update a snippet (creates a new version)",
    tags: ["snippets"],
    responses: {
      200: { description: "Snippet updated" },
      403: { description: "Feature disabled or not authorized" },
      404: { description: "Snippet not found" },
    },
  }),
  validator("json", SnippetUpdateSchema),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("code_snippets");
    if (!enabled) {
      return c.json({ error: "Code snippets feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const db = getDb();

    const snippet = await db
      .selectFrom("snippets")
      .select(["id", "user_id", "current_version", "code"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!snippet) {
      return c.json({ error: "Snippet not found" }, 404);
    }

    if (snippet.user_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Not authorized" }, 403);
    }

    const newVersion = snippet.current_version + 1;
    const newCode = body.code ?? snippet.code;

    // Update snippet
    const updateData: any = { updated_at: new Date() };
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.language !== undefined) updateData.language = body.language;
    if (body.code !== undefined) updateData.code = body.code;
    if (body.visibility !== undefined) updateData.visibility = body.visibility;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.code !== undefined) {
      updateData.current_version = newVersion;
    }

    await db.updateTable("snippets").set(updateData).where("id", "=", id).execute();

    // Create new version if code changed
    if (body.code !== undefined) {
      await db
        .insertInto("snippet_versions")
        .values({
          id: crypto.randomUUID(),
          snippet_id: id,
          version: newVersion,
          code: newCode,
          changelog: body.changelog ?? null,
        })
        .execute();
    }

    return c.json({ id, current_version: body.code ? newVersion : snippet.current_version });
  }
);

// ── DELETE /snippets/:id ───────────────────────────────────────────

snippetsRoutes.delete(
  "/:id",
  describeRoute({
    description: "Delete a snippet",
    tags: ["snippets"],
    responses: {
      200: { description: "Snippet deleted" },
      403: { description: "Feature disabled or not authorized" },
      404: { description: "Snippet not found" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("code_snippets");
    if (!enabled) {
      return c.json({ error: "Code snippets feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = getDb();

    const snippet = await db
      .selectFrom("snippets")
      .select(["user_id"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!snippet) {
      return c.json({ error: "Snippet not found" }, 404);
    }

    if (snippet.user_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Not authorized" }, 403);
    }

    await db.deleteFrom("snippets").where("id", "=", id).execute();
    return c.json({ deleted: id });
  }
);

// ── POST /snippets/:id/fork ────────────────────────────────────────

snippetsRoutes.post(
  "/:id/fork",
  describeRoute({
    description: "Fork a snippet",
    tags: ["snippets"],
    responses: {
      201: { description: "Snippet forked" },
      403: { description: "Feature disabled" },
      404: { description: "Snippet not found" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("code_snippets");
    if (!enabled) {
      return c.json({ error: "Code snippets feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const sourceId = c.req.param("id");
    const db = getDb();

    const source = await db
      .selectFrom("snippets")
      .select(["id", "title", "description", "language", "code", "tags", "visibility"])
      .where("id", "=", sourceId)
      .executeTakeFirst();

    if (!source) {
      return c.json({ error: "Snippet not found" }, 404);
    }

    const newId = generateId();
    await db
      .insertInto("snippets")
      .values({
        id: newId,
        title: `Fork of ${source.title}`,
        description: source.description,
        user_id: user.id,
        language: source.language,
        code: source.code,
        visibility: "public",
        fork_of: sourceId,
        tags: source.tags,
      })
      .execute();

    await db
      .insertInto("snippet_versions")
      .values({
        id: crypto.randomUUID(),
        snippet_id: newId,
        version: 1,
        code: source.code,
        changelog: `Forked from ${sourceId}`,
      })
      .execute();

    return c.json({ id: newId }, 201);
  }
);

// ── GET /snippets/:id/versions ─────────────────────────────────────

snippetsRoutes.get(
  "/:id/versions",
  describeRoute({
    description: "Get version history for a snippet",
    tags: ["snippets"],
    responses: {
      200: { description: "Version list" },
      403: { description: "Feature disabled" },
    },
  }),
  async (c) => {
    const enabled = await isFeatureEnabled("code_snippets");
    if (!enabled) {
      return c.json({ error: "Code snippets feature is not enabled" }, 403);
    }

    const id = c.req.param("id");
    const db = getDb();

    const versions = await db
      .selectFrom("snippet_versions")
      .select(["id", "version", "code", "changelog", "created_at"])
      .where("snippet_id", "=", id)
      .orderBy("version", "desc")
      .execute();

    return c.json({
      versions: versions.map((v) => ({
        ...v,
        created_at: v.created_at.toISOString(),
      })),
    });
  }
);

// ── GET /snippets/:id/raw ──────────────────────────────────────────

snippetsRoutes.get(
  "/:id/raw",
  describeRoute({
    description: "Get raw code for a snippet (for embeds)",
    tags: ["snippets"],
    responses: {
      200: { description: "Raw code" },
      404: { description: "Snippet not found" },
    },
  }),
  async (c) => {
    const id = c.req.param("id");
    const db = getDb();

    const snippet = await db
      .selectFrom("snippets")
      .select(["code", "visibility"])
      .where("id", "=", id)
      .executeTakeFirst();

    if (!snippet || snippet.visibility !== "public") {
      return c.json({ error: "Snippet not found" }, 404);
    }

    return c.text(snippet.code, 200, {
      "Content-Type": "text/plain; charset=utf-8",
    });
  }
);
