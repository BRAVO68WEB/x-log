import Redis from "ioredis";
import { getEnv } from "@xlog/config";
import { getDb } from "@xlog/db";
import {
  getActorUrlSync,
  getFollowersUrlSync,
  getPostUrlSync,
  createDeleteActivity,
} from "@xlog/ap";

const env = getEnv();
let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL);
  }
  return redis;
}

export interface DeliveryJob {
  activityId: string;
  userId: string;
  postId: string;
  inboxUrl: string;
  activityType?: "Create" | "Update" | "Delete";
  activityJson?: string;
}

export async function enqueueDelivery(job: DeliveryJob): Promise<void> {
  const r = getRedis();
  await r.lpush("federation:deliveries", JSON.stringify(job));
}

export async function enqueueDeliveriesToFollowers(
  userId: string,
  postId: string,
  activityId: string,
  activityType: "Create" | "Update" | "Delete",
  domain: string,
  activityJson?: string
): Promise<void> {
  const db = getDb();

  const followers = await db
    .selectFrom("followers")
    .select(["inbox_url"])
    .where("local_user_id", "=", userId)
    .where("approved", "=", true)
    .execute();

  const uniqueInboxes = [...new Set(followers.map((f) => f.inbox_url))];

  for (const inboxUrl of uniqueInboxes) {
    await enqueueDelivery({
      activityId,
      userId,
      postId,
      inboxUrl,
      activityType,
      activityJson,
    });
  }
}
