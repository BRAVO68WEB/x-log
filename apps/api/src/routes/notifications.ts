import { Hono } from "hono";
import { z } from "zod";
import { describeRoute, validator } from "hono-openapi";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { countUnread, listNotifications, markRead } from "../lib/notifications";

export const notificationsRoutes = new Hono().use("*", sessionMiddleware);

notificationsRoutes.get(
  "/",
  describeRoute({
    description: "List notifications for the current user",
    tags: ["notifications"],
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const unreadOnly = c.req.query("unread") === "true";
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") || 30)));
    try {
      const items = await listNotifications(user.id, { limit, unreadOnly });
      const unread = await countUnread(user.id);
      return c.json({ items, unread_count: unread });
    } catch {
      // table missing before migration
      return c.json({ items: [], unread_count: 0 });
    }
  }
);

notificationsRoutes.get(
  "/unread-count",
  describeRoute({
    description: "Unread notification count",
    tags: ["notifications"],
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    try {
      const count = await countUnread(user.id);
      return c.json({ count });
    } catch {
      return c.json({ count: 0 });
    }
  }
);

notificationsRoutes.post(
  "/read",
  describeRoute({
    description: "Mark notifications read (all if ids omitted)",
    tags: ["notifications"],
  }),
  requireAuth,
  validator(
    "json",
    z.object({
      ids: z.array(z.string().uuid()).optional(),
    })
  ),
  async (c) => {
    const user = c.get("user")!;
    const body = c.req.valid("json");
    try {
      const updated = await markRead(user.id, body.ids);
      return c.json({ updated });
    } catch {
      return c.json({ updated: 0 });
    }
  }
);
