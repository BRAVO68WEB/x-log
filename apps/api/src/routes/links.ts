import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { LinkCreateSchema, LinkUpdateSchema } from "@xlog/validation";
import { getDb } from "@xlog/db";
import { generateId } from "@xlog/snowflake";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { isFeatureEnabled } from "../lib/features";

async function fetchOgMetadata(
  url: string
): Promise<{ title?: string; description?: string; image?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "x-log/1.0 (link-archiver)" },
    });
    clearTimeout(timeout);

    const html = await res.text();
    const getMeta = (property: string): string | undefined => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
        new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m) return m[1];
      }
      return undefined;
    };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return {
      title: getMeta("og:title") || titleMatch?.[1]?.trim(),
      description: getMeta("og:description") || getMeta("description"),
      image: getMeta("og:image"),
    };
  } catch {
    return {};
  }
}

async function archiveToWayback(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`https://web.archive.org/save/${url}`, {
      signal: controller.signal,
      headers: { "User-Agent": "x-log/1.0 (link-archiver)" },
    });
    clearTimeout(timeout);

    if (res.ok) {
      return res.url || `https://web.archive.org/web/*/${url}`;
    }
    return null;
  } catch {
    return null;
  }
}

export const linksRoutes = new Hono().use("*", sessionMiddleware);

// ── GET /links ─────────────────────────────────────────────────────

linksRoutes.get(
  "/",
  describeRoute({
    description: "List public archived links",
    tags: ["links"],
    responses: {
      200: { description: "Link list" },
      403: { description: "Feature disabled" },
    },
  }),
  async (c) => {
    const enabled = await isFeatureEnabled("link_archive");
    if (!enabled) {
      return c.json({ error: "Link archive feature is not enabled" }, 403);
    }

    const db = getDb();
    const limit = Math.min(Number(c.req.query("limit") || 20), 100);
    const cursor = c.req.query("cursor");
    const userId = c.req.query("user_id");
    const tag = c.req.query("tag");

    let query = db
      .selectFrom("links")
      .leftJoin("users", "users.id", "links.user_id")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .leftJoin("link_snapshots", "link_snapshots.link_id", "links.id")
      .select([
        "links.id",
        "links.url",
        "links.title",
        "links.description",
        "links.thumbnail",
        "links.og_image",
        "links.tags",
        "links.view_count",
        "links.is_public",
        "links.user_id",
        "links.archived_at",
        "users.username",
        "user_profiles.full_name",
        "user_profiles.avatar_url",
        "link_snapshots.archived_url",
      ])
      .where("links.is_public", "=", true)
      .orderBy("links.archived_at", "desc")
      .limit(limit + 1);

    if (cursor) {
      query = query.where("links.archived_at", "<", new Date(cursor));
    }
    if (userId) {
      query = query.where("links.user_id", "=", userId);
    }

    const rows = await query.execute();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description,
      thumbnail: row.thumbnail,
      og_image: row.og_image,
      tags: row.tags ?? [],
      view_count: row.view_count,
      is_public: row.is_public,
      archived_url: row.archived_url ?? null,
      user: {
        id: row.user_id,
        username: row.username ?? "unknown",
        full_name: row.full_name ?? null,
        avatar_url: row.avatar_url ?? null,
      },
      archived_at: row.archived_at.toISOString(),
    }));

    return c.json({
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1].archived_at : undefined,
    });
  }
);

// ── GET /links/:id ─────────────────────────────────────────────────

linksRoutes.get(
  "/:id",
  describeRoute({
    description: "Get a single archived link",
    tags: ["links"],
    responses: {
      200: { description: "Link details" },
      403: { description: "Feature disabled" },
      404: { description: "Link not found" },
    },
  }),
  async (c) => {
    const enabled = await isFeatureEnabled("link_archive");
    if (!enabled) {
      return c.json({ error: "Link archive feature is not enabled" }, 403);
    }

    const id = c.req.param("id");
    const db = getDb();

    const link = await db
      .selectFrom("links")
      .leftJoin("users", "users.id", "links.user_id")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .leftJoin("link_snapshots", "link_snapshots.link_id", "links.id")
      .select([
        "links.id",
        "links.url",
        "links.title",
        "links.description",
        "links.thumbnail",
        "links.og_image",
        "links.tags",
        "links.view_count",
        "links.is_public",
        "links.user_id",
        "links.archived_at",
        "users.username",
        "user_profiles.full_name",
        "user_profiles.avatar_url",
        "link_snapshots.archived_url",
      ])
      .where("links.id", "=", id)
      .executeTakeFirst();

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    // Increment view count
    await db
      .updateTable("links")
      .set({ view_count: link.view_count + 1 })
      .where("id", "=", id)
      .execute();

    return c.json({
      id: link.id,
      url: link.url,
      title: link.title,
      description: link.description,
      thumbnail: link.thumbnail,
      og_image: link.og_image,
      tags: link.tags ?? [],
      view_count: link.view_count + 1,
      is_public: link.is_public,
      archived_url: link.archived_url ?? null,
      user: {
        id: link.user_id,
        username: link.username ?? "unknown",
        full_name: link.full_name ?? null,
        avatar_url: link.avatar_url ?? null,
      },
      archived_at: link.archived_at.toISOString(),
    });
  }
);

// ── POST /links ────────────────────────────────────────────────────

linksRoutes.post(
  "/",
  describeRoute({
    description: "Archive a new link",
    tags: ["links"],
    responses: {
      201: { description: "Link archived" },
      403: { description: "Feature disabled" },
    },
  }),
  validator("json", LinkCreateSchema),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("link_archive");
    if (!enabled) {
      return c.json({ error: "Link archive feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const body = c.req.valid("json");
    const db = getDb();

    // Fetch OGP metadata if title not provided
    let title = body.title;
    let description = body.description;
    let ogImage: string | undefined;

    if (!title || !description) {
      const meta = await fetchOgMetadata(body.url);
      if (!title) title = meta.title;
      if (!description) description = meta.description;
      ogImage = meta.image;
    }

    const id = generateId();
    await db
      .insertInto("links")
      .values({
        id,
        url: body.url,
        title: title ?? null,
        description: description ?? null,
        og_image: ogImage ?? null,
        user_id: user.id,
        tags: body.tags,
      })
      .execute();

    return c.json({ id, url: body.url, title, description, og_image: ogImage ?? null }, 201);
  }
);

// ── PUT /links/:id ─────────────────────────────────────────────────

linksRoutes.put(
  "/:id",
  describeRoute({
    description: "Update an archived link",
    tags: ["links"],
    responses: {
      200: { description: "Link updated" },
      403: { description: "Feature disabled or not authorized" },
      404: { description: "Link not found" },
    },
  }),
  validator("json", LinkUpdateSchema),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("link_archive");
    if (!enabled) {
      return c.json({ error: "Link archive feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const db = getDb();

    const link = await db
      .selectFrom("links")
      .select(["user_id"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!link) return c.json({ error: "Link not found" }, 404);
    if (link.user_id !== user.id && user.role !== "admin")
      return c.json({ error: "Not authorized" }, 403);

    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.is_public !== undefined) updateData.is_public = body.is_public;

    await db.updateTable("links").set(updateData).where("id", "=", id).execute();
    return c.json({ id });
  }
);

// ── DELETE /links/:id ──────────────────────────────────────────────

linksRoutes.delete(
  "/:id",
  describeRoute({
    description: "Delete an archived link",
    tags: ["links"],
    responses: {
      200: { description: "Link deleted" },
      403: { description: "Feature disabled or not authorized" },
      404: { description: "Link not found" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("link_archive");
    if (!enabled) {
      return c.json({ error: "Link archive feature is not enabled" }, 403);
    }

    const user = c.get("user")!;
    const id = c.req.param("id");
    const db = getDb();

    const link = await db
      .selectFrom("links")
      .select(["user_id"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!link) return c.json({ error: "Link not found" }, 404);
    if (link.user_id !== user.id && user.role !== "admin")
      return c.json({ error: "Not authorized" }, 403);

    await db.deleteFrom("links").where("id", "=", id).execute();
    return c.json({ deleted: id });
  }
);

// ── POST /links/:id/archive ────────────────────────────────────────

linksRoutes.post(
  "/:id/archive",
  describeRoute({
    description: "Save link to Wayback Machine",
    tags: ["links"],
    responses: {
      200: { description: "Archived" },
      403: { description: "Feature disabled" },
      404: { description: "Link not found" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("link_archive");
    if (!enabled) {
      return c.json({ error: "Link archive feature is not enabled" }, 403);
    }

    const id = c.req.param("id");
    const db = getDb();

    const link = await db
      .selectFrom("links")
      .select(["url"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!link) return c.json({ error: "Link not found" }, 404);

    const archivedUrl = await archiveToWayback(link.url);

    if (archivedUrl) {
      await db
        .insertInto("link_snapshots")
        .values({ id: crypto.randomUUID(), link_id: id, archived_url: archivedUrl })
        .execute();
    }

    return c.json({ archived_url: archivedUrl, success: !!archivedUrl });
  }
);
