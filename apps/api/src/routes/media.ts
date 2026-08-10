import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { getDb, getInstanceSettings } from "@xlog/db";
import { getEnv } from "@xlog/config";
import {
  getMediaStorage,
  makeObjectKey,
  getMediaDriver,
} from "../lib/media-storage";
import {
  cleanupOrphanMedia,
  etagMatches,
  getMediaStats,
  listDbOrphans,
  listUntrackedLocalFiles,
  mediaEtag,
} from "../lib/media-cleanup";
import { join } from "path";
import { existsSync } from "fs";
import { readdir, stat } from "fs/promises";

export const mediaRoutes = new Hono().use("*", sessionMiddleware);

mediaRoutes.post(
  "/upload",
  describeRoute({
    description: "Upload media file",
    tags: ["media"],
    responses: {
      200: {
        description: "File uploaded",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                url: z.string().url(),
              })
            ),
          },
        },
      },
    },
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const body = await c.req.parseBody();
    const file = body.file as File;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "Invalid file type" }, 400);
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: "File too large" }, 400);
    }

    const assetType = (body.asset_type as string) || "post_attachment";
    if (assetType !== "banner" && assetType !== "post_attachment") {
      return c.json({ error: "Invalid asset_type" }, 400);
    }

    try {
      const storage = await getMediaStorage();
      const key = makeObjectKey(file.name || "upload.bin");
      const arrayBuffer = await file.arrayBuffer();
      const { url, key: storedKey } = await storage.put({
        key,
        body: Buffer.from(arrayBuffer),
        contentType: file.type,
      });

      const db = getDb();
      await db
        .insertInto("media")
        .values({
          filename: storedKey,
          url,
          user_id: user.id,
          asset_type: assetType as "banner" | "post_attachment",
          size: file.size,
          mime_type: file.type,
        })
        .execute();

      return c.json({ url, driver: storage.driver });
    } catch (err) {
      console.error("[media] upload failed:", err);
      return c.json(
        { error: err instanceof Error ? err.message : "Upload failed" },
        500
      );
    }
  }
);

mediaRoutes.get(
  "/",
  describeRoute({
    description: "List uploaded media files",
    tags: ["media"],
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();
    const settings = await getInstanceSettings();
    const isDev = process.env.NODE_ENV === "development";
    const protocol = isDev ? "http" : "https";

    let mediaQuery = db
      .selectFrom("media")
      .leftJoin("posts", "media.post_id", "posts.id")
      .select([
        "media.id",
        "media.filename",
        "media.url",
        "media.size",
        "media.mime_type",
        "media.asset_type",
        "media.post_id",
        "media.created_at",
        "posts.title as post_title",
      ])
      .orderBy("media.created_at", "desc");

    if (user.role !== "admin") {
      mediaQuery = mediaQuery.where("media.user_id", "=", user.id);
    }

    const dbItems = await mediaQuery.execute();
    const trackedFilenames = new Set(dbItems.map((item) => item.filename));

    const items: {
      filename: string;
      url: string;
      size: number;
      uploaded_at: string;
      type: string;
      asset_type: string | null;
      post_id: string | null;
      post_title: string | null;
    }[] = dbItems.map((item) => ({
      filename: item.filename,
      url: item.url,
      size: item.size,
      uploaded_at: item.created_at.toISOString(),
      type: item.mime_type,
      asset_type: item.asset_type as string | null,
      post_id: item.post_id,
      post_title: item.post_title || null,
    }));

    // Local driver only: untracked filesystem files for admins
    if (user.role === "admin" && getMediaDriver() === "local") {
      const uploadDir = join(process.cwd(), "uploads");
      if (existsSync(uploadDir)) {
        const files = await readdir(uploadDir);
        const mimeMap: Record<string, string> = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          gif: "image/gif",
          webp: "image/webp",
        };

        for (const filename of files) {
          if (trackedFilenames.has(filename)) continue;
          const filepath = join(uploadDir, filename);
          const fileStat = await stat(filepath);
          const ext = filename.split(".").pop()?.toLowerCase() || "";
          items.push({
            filename,
            url: `${protocol}://${settings.instance_domain}/api/media/${filename}`,
            size: fileStat.size,
            uploaded_at: fileStat.mtime.toISOString(),
            type: mimeMap[ext] || "application/octet-stream",
            asset_type: null,
            post_id: null,
            post_title: null,
          });
        }

        items.sort(
          (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        );
      }
    }

    return c.json({ items, driver: getMediaDriver() });
  }
);

// Static paths before /:filename
mediaRoutes.get(
  "/stats",
  describeRoute({
    description: "Media library stats (counts and bytes)",
    tags: ["media"],
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const stats = await getMediaStats({
      userId: user.id,
      isAdmin: user.role === "admin",
    });
    return c.json(stats);
  }
);

mediaRoutes.get(
  "/orphans",
  describeRoute({
    description: "List orphan media (unlinked to posts)",
    tags: ["media"],
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const olderThanDays = Math.max(0, Number(c.req.query("older_than_days") || "0") || 0);
    const includeUntracked = c.req.query("include_untracked") === "true";

    const items = await listDbOrphans({
      userId: user.id,
      isAdmin: user.role === "admin",
      olderThanDays: olderThanDays || undefined,
      limit: 200,
    });

    if (includeUntracked && user.role === "admin") {
      const untracked = await listUntrackedLocalFiles();
      for (const u of untracked) items.push(u);
    }

    return c.json({
      items,
      count: items.length,
      older_than_days: olderThanDays || null,
    });
  }
);

mediaRoutes.post(
  "/cleanup",
  describeRoute({
    description: "Purge orphan media (dry_run supported)",
    tags: ["media"],
    responses: {
      200: { description: "Cleanup result" },
    },
  }),
  requireAuth,
  validator(
    "json",
    z.object({
      dry_run: z.boolean().optional().default(true),
      older_than_days: z.number().int().min(0).max(3650).optional().default(7),
      include_untracked: z.boolean().optional().default(false),
      limit: z.number().int().min(1).max(200).optional().default(100),
    })
  ),
  async (c) => {
    const user = c.get("user")!;
    const body = c.req.valid("json");

    if (body.include_untracked && user.role !== "admin") {
      return c.json({ error: "Only admins can clean untracked local files" }, 403);
    }

    const result = await cleanupOrphanMedia({
      userId: user.id,
      isAdmin: user.role === "admin",
      dryRun: body.dry_run ?? true,
      olderThanDays: body.older_than_days ?? 7,
      includeUntracked: Boolean(body.include_untracked),
      limit: body.limit ?? 100,
    });

    return c.json({
      ...result,
      deleted_count: result.deleted.length,
      failed_count: result.failed.length,
    });
  }
);

mediaRoutes.delete(
  "/:filename",
  describeRoute({
    description: "Delete an uploaded media file",
    tags: ["media"],
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const filename = c.req.param("filename");

    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    const db = getDb();
    const record = await db
      .selectFrom("media")
      .select(["id", "user_id", "filename"])
      .where("filename", "=", filename)
      .executeTakeFirst();

    if (record) {
      if (user.role !== "admin" && record.user_id !== user.id) {
        return c.json({ error: "Forbidden" }, 403);
      }
    } else if (user.role !== "admin") {
      return c.json({ error: "Forbidden" }, 403);
    }

    try {
      const storage = await getMediaStorage();
      await storage.delete(filename);
    } catch (err) {
      console.error("[media] delete storage error:", err);
    }

    if (record) {
      await db.deleteFrom("media").where("filename", "=", filename).execute();
    } else {
      // local untracked: check existence via get
      const storage = await getMediaStorage();
      const obj = await storage.get(filename);
      if (!obj && !record) {
        return c.json({ error: "File not found" }, 404);
      }
    }

    return c.json({ message: "File deleted" });
  }
);

mediaRoutes.get("/:filename", async (c) => {
  const filename = c.req.param("filename");
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  const env = getEnv();
  // S3 with public CDN: redirect so API doesn't proxy bytes
  if (env.MEDIA_DRIVER === "s3" && env.MEDIA_S3_PUBLIC_URL) {
    const storage = await getMediaStorage();
    return c.redirect(storage.publicUrl(filename), 302);
  }

  try {
    const storage = await getMediaStorage();
    const obj = await storage.get(filename);
    if (!obj) {
      return c.json({ error: "File not found" }, 404);
    }

    const etag = mediaEtag(filename, obj.body.length);
    const headers: Record<string, string> = {
      "Content-Type": obj.contentType,
      "Content-Length": String(obj.body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    };

    const inm = c.req.header("if-none-match");
    if (etagMatches(inm, etag)) {
      return new Response(null, { status: 304, headers });
    }

    return c.body(new Uint8Array(obj.body), 200, headers);
  } catch (err) {
    console.error("[media] serve error:", err);
    return c.json({ error: "File not found" }, 404);
  }
});

mediaRoutes.on("HEAD", "/:filename", async (c) => {
  const filename = c.req.param("filename");
  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return c.json({ error: "Invalid filename" }, 400);
  }

  const env = getEnv();
  if (env.MEDIA_DRIVER === "s3" && env.MEDIA_S3_PUBLIC_URL) {
    const storage = await getMediaStorage();
    return c.redirect(storage.publicUrl(filename), 302);
  }

  try {
    const storage = await getMediaStorage();
    const obj = await storage.get(filename);
    if (!obj) {
      return c.json({ error: "File not found" }, 404);
    }
    const etag = mediaEtag(filename, obj.body.length);
    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": obj.contentType,
        "Content-Length": String(obj.body.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return c.json({ error: "File not found" }, 404);
  }
});
