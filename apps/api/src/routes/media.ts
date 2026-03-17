import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { getDb, getInstanceSettings } from "@xlog/db";
import { writeFile, mkdir, readdir, stat, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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
            schema: resolver(z.object({
              url: z.string().url(),
            })),
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

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: "Invalid file type" }, 400);
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ error: "File too large" }, 400);
    }

    // Validate asset_type if provided
    const assetType = (body.asset_type as string) || "post_attachment";
    if (assetType !== "banner" && assetType !== "post_attachment") {
      return c.json({ error: "Invalid asset_type" }, 400);
    }

    const uploadDir = join(process.cwd(), "uploads");
    const filename = `${crypto.randomUUID()}-${file.name}`;
    const filepath = join(uploadDir, filename);

    // Ensure upload directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Save file
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(arrayBuffer));

    const settings = await getInstanceSettings();
    const isDev = process.env.NODE_ENV === "development";
    const url = isDev ? `http://${settings.instance_domain}/api/media/${filename}` : `https://${settings.instance_domain}/api/media/${filename}`;

    // Insert DB record
    const db = getDb();
    await db
      .insertInto("media")
      .values({
        filename,
        url,
        user_id: user.id,
        asset_type: assetType as "banner" | "post_attachment",
        size: file.size,
        mime_type: file.type,
      })
      .execute();

    return c.json({ url });
  }
);

mediaRoutes.get(
  "/",
  describeRoute({
    description: "List uploaded media files",
    tags: ["media"],
    responses: {
      200: {
        description: "List of media files",
        content: {
          "application/json": {
            schema: resolver(z.object({
              items: z.array(z.object({
                filename: z.string(),
                url: z.string(),
                size: z.number(),
                uploaded_at: z.string(),
                type: z.string(),
                asset_type: z.string().nullable(),
                post_id: z.string().nullable(),
                post_title: z.string().nullable(),
              })),
            })),
          },
        },
      },
    },
  }),
  requireAuth,
  async (c) => {
    const db = getDb();
    const settings = await getInstanceSettings();
    const isDev = process.env.NODE_ENV === "development";
    const protocol = isDev ? "http" : "https";

    // Query DB for tracked media
    const dbItems = await db
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
      .orderBy("media.created_at", "desc")
      .execute();

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

    // Backwards compat: include filesystem-only files not in DB
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

      // Re-sort after merging
      items.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    }

    return c.json({ items });
  }
);

mediaRoutes.delete(
  "/:filename",
  describeRoute({
    description: "Delete an uploaded media file",
    tags: ["media"],
    responses: {
      200: { description: "File deleted" },
      404: { description: "File not found" },
    },
  }),
  requireAuth,
  async (c) => {
    const filename = c.req.param("filename");

    // Prevent path traversal
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      return c.json({ error: "Invalid filename" }, 400);
    }

    const filepath = join(process.cwd(), "uploads", filename);
    if (!existsSync(filepath)) {
      return c.json({ error: "File not found" }, 404);
    }

    await unlink(filepath);

    // Remove DB record if exists
    const db = getDb();
    await db.deleteFrom("media").where("filename", "=", filename).execute();

    return c.json({ message: "File deleted" });
  }
);

mediaRoutes.get("/:filename", async (c) => {
  const filename = c.req.param("filename");
  const filepath = join(process.cwd(), "uploads", filename);

  if (!existsSync(filepath)) {
    return c.json({ error: "File not found" }, 404);
  }

  const file = Bun.file(filepath);
  return c.body(await file.arrayBuffer(), 200, {
    "Content-Type": file.type || "application/octet-stream",
  });
});
