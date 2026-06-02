import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { getDb } from "@xlog/db";
import { renderMarkdown } from "@xlog/markdown";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { getPrimaryProfileUser } from "../lib/activitypub";

export const feedRoutes = new Hono().use("*", sessionMiddleware);

function stripHtml(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toDateString(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function actorHandle(actor: string): string | null {
  try {
    const url = new URL(actor);
    const username = url.pathname.split("/").filter(Boolean).pop();
    return username ? `@${username}@${url.hostname}` : null;
  } catch {
    return null;
  }
}

function getActivityObject(activity: any): any {
  if (activity.type === "Announce") {
    return typeof activity.object === "object" ? activity.object : null;
  }
  return typeof activity.object === "object" ? activity.object : null;
}

feedRoutes.get(
  "/following",
  describeRoute({
    description: "List latest posts received from followed actors",
    tags: ["feed"],
    responses: {
      200: {
        description: "Following feed",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                items: z.array(
                  z.object({
                    id: z.string(),
                    type: z.enum(["Create", "Announce"]),
                    actor: z.string(),
                    actor_handle: z.string().nullable(),
                    object_id: z.string(),
                    title: z.string().nullable(),
                    summary: z.string().nullable(),
                    content_html: z.string(),
                    url: z.string(),
                    published_at: z.string().nullable(),
                    received_at: z.string(),
                  })
                ),
                nextCursor: z.string().optional(),
                hasMore: z.boolean(),
              })
            ),
          },
        },
      },
    },
  }),
  validator(
    "query",
    z.object({
      limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("20"),
      cursor: z.string().optional(),
    })
  ),
  requireAuth,
  async (c) => {
    const { limit, cursor } = c.req.valid("query");
    const db = getDb();
    const primaryProfile = await getPrimaryProfileUser(db);

    if (!primaryProfile) {
      return c.json({ items: [], hasMore: false });
    }

    let query = db
      .selectFrom("inbox_objects")
      .innerJoin("following", (join) =>
        join
          .onRef("following.remote_actor", "=", "inbox_objects.actor")
          .on("following.local_user_id", "=", primaryProfile.id)
      )
      .select([
        "inbox_objects.id",
        "inbox_objects.type",
        "inbox_objects.actor",
        "inbox_objects.object_id",
        "inbox_objects.raw",
        "inbox_objects.received_at",
      ])
      .where("inbox_objects.local_user_id", "=", primaryProfile.id)
      .where("inbox_objects.type", "in", ["Create", "Announce"])
      .orderBy("inbox_objects.received_at", "desc")
      .orderBy("inbox_objects.id", "desc")
      .limit(limit + 1);

    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        query = query.where("inbox_objects.received_at", "<", cursorDate);
      }
    }

    const rows = await query.execute();
    const page = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    const items = await Promise.all(
      page.map(async (row) => {
        const activity = row.raw as any;
        const object = getActivityObject(activity);
        const objectId =
          object?.id || (typeof activity.object === "string" ? activity.object : row.object_id);
        const title =
          typeof object?.name === "string" && object.name.trim() ? object.name.trim() : null;
        const summary =
          typeof object?.summary === "string" && object.summary.trim()
            ? stripHtml(object.summary)
            : null;
        const contentText =
          typeof object?.content === "string" && object.content.trim()
            ? stripHtml(object.content)
            : title || objectId;
        const url =
          typeof object?.url === "string"
            ? object.url
            : typeof objectId === "string"
              ? objectId
              : row.object_id;

        return {
          id: row.id,
          type: row.type as "Create" | "Announce",
          actor: row.actor,
          actor_handle: actorHandle(row.actor),
          object_id: objectId,
          title,
          summary,
          content_html: await renderMarkdown(contentText || ""),
          url,
          published_at: toDateString(object?.published || activity.published),
          received_at: row.received_at.toISOString(),
        };
      })
    );

    return c.json({
      items,
      nextCursor: hasMore ? page[page.length - 1]?.received_at.toISOString() : undefined,
      hasMore,
    });
  }
);
