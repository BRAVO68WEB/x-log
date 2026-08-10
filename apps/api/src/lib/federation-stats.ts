import { getDb } from "@xlog/db";
import { enqueueDelivery } from "./redis";

export async function getDeliveryStats24h() {
  const db = getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const rows = await db
    .selectFrom("deliveries")
    .select(["status"])
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("updated_at", ">=", since)
    .groupBy("status")
    .execute();

  const byStatus: Record<string, number> = {
    pending: 0,
    sent: 0,
    failed: 0,
    retrying: 0,
  };
  let total = 0;
  for (const r of rows) {
    byStatus[r.status] = Number(r.count);
    total += Number(r.count);
  }

  return {
    window_hours: 24,
    total,
    by_status: byStatus,
  };
}

export async function listRecentFailedDeliveries(limit = 50) {
  const db = getDb();
  const items = await db
    .selectFrom("deliveries")
    .select([
      "id",
      "activity_id",
      "remote_inbox",
      "status",
      "attempt_count",
      "last_error",
      "updated_at",
      "user_id",
      "post_id",
    ])
    .where("status", "=", "failed")
    .orderBy("updated_at", "desc")
    .limit(limit)
    .execute();

  return items.map((item) => ({
    id: item.id,
    activity_id: item.activity_id,
    remote_inbox: item.remote_inbox,
    remote_host: (() => {
      try {
        return new URL(item.remote_inbox).hostname;
      } catch {
        return null;
      }
    })(),
    status: item.status,
    attempt_count: item.attempt_count,
    last_error: item.last_error,
    updated_at: item.updated_at.toISOString(),
    user_id: item.user_id,
    post_id: item.post_id,
  }));
}

export async function retryDelivery(deliveryId: string): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  const row = await db
    .selectFrom("deliveries")
    .selectAll()
    .where("id", "=", deliveryId)
    .executeTakeFirst();

  if (!row) return { ok: false, error: "Delivery not found" };
  if (!row.user_id || !row.post_id || !row.remote_inbox) {
    return { ok: false, error: "Delivery missing metadata for retry" };
  }

  await db
    .updateTable("deliveries")
    .set({
      status: "pending",
      last_error: null,
      updated_at: new Date(),
    })
    .where("id", "=", deliveryId)
    .execute();

  await enqueueDelivery({
    activityId: row.activity_id,
    userId: row.user_id,
    postId: row.post_id,
    inboxUrl: row.remote_inbox,
    activityJson: row.activity_json ? JSON.stringify(row.activity_json) : undefined,
  });

  return { ok: true };
}

export async function retryAllFailed(limit = 50): Promise<{ enqueued: number }> {
  const failed = await listRecentFailedDeliveries(limit);
  let enqueued = 0;
  for (const item of failed) {
    const result = await retryDelivery(item.id);
    if (result.ok) enqueued += 1;
  }
  return { enqueued };
}
