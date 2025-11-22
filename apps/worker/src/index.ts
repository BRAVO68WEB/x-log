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
    const post = await db
      .selectFrom("posts")
      .innerJoin("users", "users.id", "posts.author_id")
      .select([
        "posts.id",
        "posts.title",
        "posts.content_markdown",
        "posts.hashtags",
        "posts.summary",
        "posts.banner_url",
        "posts.published_at",
        "users.username",
      ])
      .where("posts.id", "=", delivery.postId)
      .executeTakeFirst();

    if (!post || !post.published_at) {
      throw new Error("Post not found or not published");
    }

    const actorId = getActorUrl(post.username);
    const contentHtml = renderMarkdownSync(post.content_markdown);
    const article = createArticleObject(
      post.id,
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

    const body = JSON.stringify(activity);
    const signature = await signRequest("POST", delivery.inboxUrl, body, delivery.userId);

    const response = await fetch(delivery.inboxUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/activity+json",
        Signature: signature,
        Date: new Date().toUTCString(),
        Host: new URL(delivery.inboxUrl).host,
      },
      body,
    });

    if (response.ok) {
      await db
        .updateTable("deliveries")
        .set({
          status: "sent",
          attempt_count: (await db.selectFrom("deliveries").select("attempt_count").where("id", "=", delivery.activityId).executeTakeFirst())?.attempt_count || 0 + 1,
          updated_at: new Date(),
        })
        .where("activity_id", "=", delivery.activityId)
        .execute();
    } else {
      throw new Error(`Delivery failed: ${response.status}`);
    }
  } catch (error) {
    console.error("Delivery error:", error);
    await db
      .updateTable("deliveries")
      .set({
        status: "failed",
        attempt_count: (await db.selectFrom("deliveries").select("attempt_count").where("id", "=", delivery.activityId).executeTakeFirst())?.attempt_count || 0 + 1,
        last_error: String(error),
        updated_at: new Date(),
      })
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
        // Calculate exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, delivery.attempt_count), 3600000); // Max 1 hour
        const nextAttempt = new Date(Date.now() + delay);

        // Only retry if enough time has passed
        if (delivery.updated_at < nextAttempt) {
          const job: DeliveryJob = {
            activityId: delivery.activity_id,
            userId: "", // TODO: Get from activity
            postId: "", // TODO: Get from activity
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

