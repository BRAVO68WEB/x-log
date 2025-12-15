import { Hono } from "hono";
import { getDb } from "@xlog/db";
import { sessionMiddleware, requireAdmin } from "../middleware/session";

export const adminRoutes = new Hono().use("*", sessionMiddleware);

adminRoutes.get("/deliveries/failed", requireAdmin, async (c) => {
  const db = getDb();
  const items = await db
    .selectFrom("deliveries")
    .select(["activity_id", "remote_inbox", "status", "attempt_count", "last_error", "updated_at", "activity_json"])
    .where("status", "=", "failed")
    .orderBy("updated_at", "desc")
    .limit(100)
    .execute();

  return c.json({ items });
});

