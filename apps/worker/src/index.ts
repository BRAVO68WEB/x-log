import Redis from "ioredis";
import { getEnv } from "@xlog/config";
import { getDb } from "@xlog/db";
import { signRequest, createCreateActivity, createArticleObject, getActorUrl } from "@xlog/ap";
import { renderMarkdownSync } from "@xlog/markdown";

const env = getEnv();
const redis = new Redis(env.REDIS_URL);
const db = getDb();

console.log("Worker started");

interface DeliveryJob {
  activityId: string;
  userId: string;
  postId: string;
  inboxUrl: string;
}

// Process federation delivery jobs
async function processDeliveryJobs() {
  while (true) {
    try {
      const job = await redis.brpop("federation:deliveries", 5);
      if (job) {
        const [, jobData] = job;
        const delivery: DeliveryJob = JSON.parse(jobData);
        await deliverActivity(delivery);
      }
    } catch (error) {
      console.error("Error processing job:", error);
    }
  }
}

async function deliverActivity(delivery: DeliveryJob) {
  try {
    const existing = await db
      .selectFrom("deliveries")
      .select(["id", "user_id", "post_id", "remote_inbox"])
      .where("activity_id", "=", delivery.activityId)
      .executeTakeFirst();

    const userId = delivery.userId || existing?.user_id || "";
    const postId = delivery.postId || existing?.post_id || "";
    const inboxUrl = delivery.inboxUrl || existing?.remote_inbox || "";

    if (!existing) {
      await db
        .insertInto("deliveries")
        .values({
          id: crypto.randomUUID(),
          activity_id: delivery.activityId,
          remote_inbox: inboxUrl,
          status: "pending",
          attempt_count: 0,
          last_error: null,
          user_id: userId,
          post_id: postId,
          activity_json: null,
        })
        .execute();
    }
    if (!userId || !postId || !inboxUrl) {
      throw new Error("Missing delivery metadata (userId, postId, inboxUrl)");
    }

    const post = await db
      .selectFrom("posts")
      .innerJoin("users", "users.id", "posts.author_id")
      .select([
        "posts.id as post_id",
        "posts.title",
        "posts.content_markdown",
        "posts.hashtags",
        "posts.summary",
        "posts.banner_url",
        "posts.published_at",
        "users.id as user_id",
        "users.username",
      ])
      .where("posts.id", "=", delivery.postId)
      .executeTakeFirst();

    if (!post || !post.published_at) {
      throw new Error("Post not found or not published");
    }

    const actorId = await getActorUrl(post.username);
    const contentHtml = renderMarkdownSync(post.content_markdown);
    const article = await createArticleObject(
      (post as any).post_id,
      actorId,
      post.title,
      contentHtml,
      post.published_at,
      post.hashtags,
      post.summary || undefined,
      post.banner_url
    );

    const activity = createCreateActivity(
      delivery.activityId,
      actorId,
      article,
      post.published_at
    );

    await db
      .insertInto("outbox_activities")
      .values({
        id: crypto.randomUUID(),
        user_id: (post as any).user_id,
        activity_id: delivery.activityId,
        type: "Create",
        object_id: article.id,
        raw: activity as any,
      })
      .onConflict((oc) => oc.columns(["activity_id"]).doNothing())
      .execute();

    const body = JSON.stringify(activity);
    const signature = await signRequest("POST", inboxUrl, body, userId);

    await db
      .updateTable("deliveries")
      .set({ activity_json: activity as any })
      .where("activity_id", "=", delivery.activityId)
      .execute();

    const response = await fetch(inboxUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/activity+json",
        Signature: signature,
        Date: new Date().toUTCString(),
        Host: new URL(inboxUrl).host,
      },
      body,
    });

    if (response.ok) {
      await db
        .updateTable("deliveries")
        .set((eb) => ({
          status: "sent",
          attempt_count: eb("attempt_count", "+", 1),
          updated_at: new Date(),
        }))
        .where("activity_id", "=", delivery.activityId)
        .execute();
    } else {
      throw new Error(`Delivery failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Delivery error:", error);
    await db
      .updateTable("deliveries")
      .set((eb) => ({
        status: "failed",
        attempt_count: eb("attempt_count", "+", 1),
        last_error: String(error),
        updated_at: new Date(),
      }))
      .where("activity_id", "=", delivery.activityId)
      .execute();
  }
}

// Process retry jobs
async function processRetryJobs() {
  while (true) {
    try {
      const failedDeliveries = await db
        .selectFrom("deliveries")
        .selectAll()
        .where("status", "=", "failed")
        .where("attempt_count", "<", 5)
        .execute();

      for (const delivery of failedDeliveries) {
        const delay = Math.min(1000 * Math.pow(2, delivery.attempt_count), 3600000);
        const nextEligible = new Date(delivery.updated_at).getTime() + delay;
        if (Date.now() >= nextEligible) {
          const job: DeliveryJob = {
            activityId: delivery.activity_id,
            userId: delivery.user_id || "",
            postId: delivery.post_id || "",
            inboxUrl: delivery.remote_inbox,
          };
          await redis.lpush("federation:deliveries", JSON.stringify(job));
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 60000)); // Check every minute
    } catch (error) {
      console.error("Error processing retry jobs:", error);
    }
  }
}

// Start workers
processDeliveryJobs();
processRetryJobs();
