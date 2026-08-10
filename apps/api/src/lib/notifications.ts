import { getDb } from "@xlog/db";
import type { NotificationType } from "@xlog/db";
import { sendEmail } from "./email";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  actorLabel: string;
  actorUrl?: string | null;
  postId?: string | null;
  body?: string | null;
  /** Skip if actor is the same as recipient (self-like) */
  actorUserId?: string | null;
};

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (input.actorUserId && input.actorUserId === input.userId) {
    return;
  }

  const db = getDb();
  try {
    await db
      .insertInto("notifications")
      .values({
        id: crypto.randomUUID(),
        user_id: input.userId,
        type: input.type,
        actor_label: input.actorLabel.slice(0, 200),
        actor_url: input.actorUrl || null,
        post_id: input.postId || null,
        body: input.body || null,
        read_at: null,
      })
      .execute();
  } catch (err) {
    console.error("[notifications] insert failed:", err);
    return;
  }

  // Optional email if SMTP configured
  void maybeEmailNotification(input).catch(() => {});
}

async function maybeEmailNotification(input: CreateNotificationInput) {
  const db = getDb();
  const user = await db
    .selectFrom("users")
    .select(["email", "username"])
    .where("id", "=", input.userId)
    .executeTakeFirst();
  if (!user?.email) return;

  const subject =
    input.type === "follow"
      ? `${input.actorLabel} followed you on x-log`
      : `${input.actorLabel} liked your post`;

  const text =
    input.type === "follow"
      ? `${input.actorLabel} is now following you.\n${input.actorUrl || ""}`
      : `${input.actorLabel} liked your post.\n${input.body || ""}\nPost: ${input.postId || ""}`;

  await sendEmail({
    to: user.email,
    subject,
    text,
    html: `<p>${text.replace(/\n/g, "<br/>")}</p>`,
  });
}

export async function listNotifications(userId: string, opts?: { limit?: number; unreadOnly?: boolean }) {
  const db = getDb();
  const limit = Math.min(100, opts?.limit ?? 30);
  let q = db
    .selectFrom("notifications")
    .selectAll()
    .where("user_id", "=", userId)
    .orderBy("created_at", "desc")
    .limit(limit);

  if (opts?.unreadOnly) {
    q = q.where("read_at", "is", null);
  }

  const rows = await q.execute();
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    actor_label: r.actor_label,
    actor_url: r.actor_url,
    post_id: r.post_id,
    body: r.body,
    read_at: r.read_at ? new Date(r.read_at).toISOString() : null,
    created_at: new Date(r.created_at).toISOString(),
  }));
}

export async function countUnread(userId: string): Promise<number> {
  const db = getDb();
  const row = await db
    .selectFrom("notifications")
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("user_id", "=", userId)
    .where("read_at", "is", null)
    .executeTakeFirst();
  return Number(row?.count || 0);
}

export async function markRead(userId: string, ids?: string[]): Promise<number> {
  const db = getDb();
  let q = db
    .updateTable("notifications")
    .set({ read_at: new Date() })
    .where("user_id", "=", userId)
    .where("read_at", "is", null);

  if (ids && ids.length > 0) {
    q = q.where("id", "in", ids);
  }

  const result = await q.executeTakeFirst();
  return Number(result.numUpdatedRows || 0);
}
