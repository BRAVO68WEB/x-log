import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { LinkCreateSchema, LinkUpdateSchema } from "@xlog/validation";
import { getDb } from "@xlog/db";
import { generateId } from "@xlog/snowflake";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { isFeatureEnabled } from "../lib/features";
import { archiveToWayback, utcDayBounds } from "../lib/wayback";

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

/** Latest non-null snapshot URL for each link id (avoids multi-row join fan-out). */
async function latestSnapshotUrls(
  db: ReturnType<typeof getDb>,
  linkIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (linkIds.length === 0) return map;
  for (const id of linkIds) map.set(id, null);

  const rows = await db
    .selectFrom("link_snapshots")
    .select(["link_id", "archived_url", "archived_at"])
    .where("link_id", "in", linkIds)
    .where("archived_url", "is not", null)
    .orderBy("archived_at", "desc")
    .execute();

  for (const row of rows) {
    if (!map.has(row.link_id)) continue;
    // first row per link is latest because of order
    if (map.get(row.link_id) === null) {
      map.set(row.link_id, row.archived_url);
    }
  }
  return map;
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
    const page = rows.slice(0, limit);
    const snapMap = await latestSnapshotUrls(
      db,
      page.map((r) => r.id)
    );
    const items = page.map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description,
      thumbnail: row.thumbnail,
      og_image: row.og_image,
      tags: row.tags ?? [],
      view_count: row.view_count,
      is_public: row.is_public,
      archived_url: snapMap.get(row.id) ?? null,
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

    const snapMap = await latestSnapshotUrls(db, [link.id]);

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
      archived_url: snapMap.get(link.id) ?? null,
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
    description:
      "Save link to Wayback Machine (at most one new snapshot row per UTC day; reuses today's capture if present)",
    tags: ["links"],
    responses: {
      200: { description: "Archived (or reused today's snapshot)" },
      403: { description: "Feature disabled" },
      404: { description: "Link not found" },
      502: { description: "Wayback Machine failed" },
    },
  }),
  requireAuth,
  async (c) => {
    const enabled = await isFeatureEnabled("link_archive");
    if (!enabled) {
      return c.json({ error: "Link archive feature is not enabled" }, 403);
    }

    const id = c.req.param("id");
    const user = c.get("user")!;
    const db = getDb();

    const link = await db
      .selectFrom("links")
      .select(["url", "user_id"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!link) return c.json({ error: "Link not found" }, 404);
    if (link.user_id !== user.id && user.role !== "admin") {
      return c.json({ error: "Not authorized", code: "forbidden" }, 403);
    }

    // One DB snapshot row per link per UTC day
    const { start, end } = utcDayBounds(new Date());
    const existingToday = await db
      .selectFrom("link_snapshots")
      .select(["id", "archived_url", "archived_at"])
      .where("link_id", "=", id)
      .where("archived_at", ">=", start)
      .where("archived_at", "<", end)
      .where("archived_url", "is not", null)
      .orderBy("archived_at", "desc")
      .executeTakeFirst();

    if (existingToday?.archived_url) {
      return c.json({
        archived_url: existingToday.archived_url,
        success: true,
        already_snapshotted_today: true,
        snapshot_at: existingToday.archived_at.toISOString(),
      });
    }

    const result = await archiveToWayback(link.url);

    if (result.archived_url) {
      await db
        .insertInto("link_snapshots")
        .values({
          id: crypto.randomUUID(),
          link_id: id,
          archived_url: result.archived_url,
        })
        .execute();
    }

    if (!result.archived_url) {
      return c.json(
        {
          archived_url: null,
          success: false,
          error: result.error || "Wayback archive failed",
          status: result.status ?? null,
        },
        result.status === 429 ? 429 : 502
      );
    }

    return c.json({
      archived_url: result.archived_url,
      success: true,
      already_snapshotted_today: false,
      reused_existing_capture: Boolean(result.reused),
      warning: result.error || null,
    });
  }
);

// ── GET /links/:id/snapshots ───────────────────────────────────────

linksRoutes.get(
  "/:id/snapshots",
  describeRoute({
    description: "List Wayback snapshots recorded for a link",
    tags: ["links"],
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
      .select(["id", "is_public", "user_id"])
      .where("id", "=", id)
      .executeTakeFirst();
    if (!link) return c.json({ error: "Link not found" }, 404);

    const user = c.get("user");
    if (!link.is_public && (!user || (user.id !== link.user_id && user.role !== "admin"))) {
      return c.json({ error: "Link not found" }, 404);
    }

    const rows = await db
      .selectFrom("link_snapshots")
      .select(["id", "archived_url", "archived_at"])
      .where("link_id", "=", id)
      .orderBy("archived_at", "desc")
      .execute();

    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        archived_url: r.archived_url,
        archived_at: r.archived_at.toISOString(),
      })),
    });
  }
);
