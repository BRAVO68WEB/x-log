import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { getEnv } from "@xlog/config";
import { writeFile, mkdir } from "fs/promises";
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

    const env = getEnv();
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

    const url = `https://${env.INSTANCE_DOMAIN}/media/${filename}`;

    return c.json({ url });
  }
);

mediaRoutes.get("/media/:filename", async (c) => {
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

