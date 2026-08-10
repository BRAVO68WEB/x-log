import crypto from "crypto";
import { getEnv } from "@xlog/config";
import { getDb } from "@xlog/db";
import { isFeatureEnabled } from "../lib/features";

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|preview|wget|curl|python-requests|httpclient|feedfetcher|mediapartners/i;

export type CollectViewInput = {
  path: string;
  postId?: string | null;
  referrer?: string | null;
  sessionId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  dnt?: boolean;
  gpc?: boolean;
};

/** Exported for unit tests */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return BOT_UA.test(ua);
}

/** Exported for unit tests */
export function parseReferrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname || null;
  } catch {
    return null;
  }
}

/** Whether collect should skip before DB (feature-agnostic). */
export function shouldSkipCollectInput(input: {
  path?: string;
  userAgent?: string | null;
  dnt?: boolean;
  gpc?: boolean;
  respectDnt?: boolean;
}): string | null {
  if (input.respectDnt !== false && (input.dnt || input.gpc)) {
    return "dnt";
  }
  if (isBotUserAgent(input.userAgent)) {
    return "bot";
  }
  const path = input.path || "";
  if (!path.startsWith("/")) {
    return "path";
  }
  return null;
}

function hashIp(ip: string): string {
  const env = getEnv();
  const salt = env.ANALYTICS_SALT || env.SESSION_SECRET;
  return crypto.createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

export function clientIpFromHeaders(headers: {
  get(name: string): string | null | undefined;
}): string | null {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export async function isAnalyticsEnabled(): Promise<boolean> {
  return isFeatureEnabled("analytics");
}

/**
 * Record a page/post view when analytics feature is enabled.
 * Returns false if skipped (disabled, bot, DNT, invalid).
 */
export async function collectPageView(input: CollectViewInput): Promise<boolean> {
  const { withSpan } = await import("../lib/tracing");
  return withSpan(
    "analytics.collect",
    {
      "http.route": (input.path || "").slice(0, 128),
      "xlog.has_post_id": Boolean(input.postId),
    },
    async () => {
      if (!(await isAnalyticsEnabled())) return false;

      const env = getEnv();
      const skip = shouldSkipCollectInput({
        path: input.path,
        userAgent: input.userAgent,
        dnt: input.dnt,
        gpc: input.gpc,
        respectDnt: env.ANALYTICS_RESPECT_DNT,
      });
      if (skip) return false;

      const ua = input.userAgent || "";
      const path = (input.path || "").slice(0, 2048);

      const db = getDb();
      let authorId: string | null = null;
      let postId = input.postId || null;

      if (postId) {
        const post = await db
          .selectFrom("posts")
          .select(["id", "author_id", "visibility", "published_at"])
          .where("id", "=", postId)
          .executeTakeFirst();
        if (!post || !post.published_at || post.visibility === "private") {
          postId = null;
        } else {
          authorId = post.author_id;
        }
      }

      const ip = input.ip || null;
      const ipHash = ip ? hashIp(ip) : null;
      // Never send raw IP to PostHog; first-party store only when env allows
      const ipRaw = env.ANALYTICS_STORE_RAW_IP && ip ? ip : null;
      const referrer = input.referrer ? input.referrer.slice(0, 2048) : null;
      const referrerHost = parseReferrerHost(referrer);

      await db
        .insertInto("page_views")
        .values({
          path,
          post_id: postId,
          author_id: authorId,
          referrer,
          referrer_host: referrerHost,
          user_agent: ua.slice(0, 512),
          ip_hash: ipHash,
          ip_raw: ipRaw,
          session_id: input.sessionId ? input.sessionId.slice(0, 128) : null,
        })
        .execute();

      if (postId) {
        await db
          .updateTable("posts")
          .set((eb) => ({ view_count: eb("view_count", "+", 1) }))
          .where("id", "=", postId)
          .execute();
      }

      return true;
    }
  );
}

export type AnalyticsTopPost = {
  post_id: string | null;
  title: string | null;
  views: number;
};

export type AnalyticsSummary = {
  days: number;
  total_views: number;
  top_posts: AnalyticsTopPost[];
  top_referrers: Array<{ host: string | null; views: number }>;
  daily: Array<{ day: string; views: number }>;
  privacy: {
    store_raw_ip: boolean;
    respect_dnt: boolean;
    retention_days: number;
  };
  scope: "all" | "own";
};

export async function getAnalyticsSummary(opts?: {
  authorId?: string;
  days?: number;
}): Promise<AnalyticsSummary> {
  const days = opts?.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const db = getDb();
  const env = getEnv();

  let base = db.selectFrom("page_views").where("created_at", ">=", since);

  if (opts?.authorId) {
    base = base.where("author_id", "=", opts.authorId);
  }

  const totalRow = await base
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .executeTakeFirst();

  let topPostsQ = db
    .selectFrom("page_views")
    .select(["post_id"])
    .select((eb) => eb.fn.countAll<number>().as("views"))
    .where("created_at", ">=", since)
    .where("post_id", "is not", null)
    .groupBy("post_id")
    .orderBy("views", "desc")
    .limit(10);

  if (opts?.authorId) {
    topPostsQ = topPostsQ.where("author_id", "=", opts.authorId);
  }

  const topPosts = await topPostsQ.execute();

  const postIds = topPosts
    .map((r) => r.post_id)
    .filter((id): id is string => Boolean(id));

  const titlesById = new Map<string, string>();
  if (postIds.length > 0) {
    const posts = await db
      .selectFrom("posts")
      .select(["id", "title"])
      .where("id", "in", postIds)
      .execute();
    for (const p of posts) {
      titlesById.set(p.id, p.title);
    }
  }

  let topRefsQ = db
    .selectFrom("page_views")
    .select(["referrer_host"])
    .select((eb) => eb.fn.countAll<number>().as("views"))
    .where("created_at", ">=", since)
    .where("referrer_host", "is not", null)
    .groupBy("referrer_host")
    .orderBy("views", "desc")
    .limit(10);

  if (opts?.authorId) {
    topRefsQ = topRefsQ.where("author_id", "=", opts.authorId);
  }

  const topReferrers = await topRefsQ.execute();

  // Aggregate daily in app code (avoids kysely dual-version raw SQL issues)
  let dailyQ = db
    .selectFrom("page_views")
    .select(["created_at"])
    .where("created_at", ">=", since);
  if (opts?.authorId) {
    dailyQ = dailyQ.where("author_id", "=", opts.authorId);
  }
  const recent = await dailyQ.execute();
  const byDay = new Map<string, number>();
  for (const row of recent) {
    const day = new Date(row.created_at).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + 1);
  }
  const daily = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, views]) => ({ day, views }));

  return {
    days,
    total_views: Number(totalRow?.count || 0),
    top_posts: topPosts.map((r) => ({
      post_id: r.post_id,
      title: r.post_id ? titlesById.get(r.post_id) ?? null : null,
      views: Number(r.views),
    })),
    top_referrers: topReferrers.map((r) => ({
      host: r.referrer_host,
      views: Number(r.views),
    })),
    daily,
    privacy: {
      store_raw_ip: env.ANALYTICS_STORE_RAW_IP,
      respect_dnt: env.ANALYTICS_RESPECT_DNT,
      retention_days: env.ANALYTICS_RETENTION_DAYS,
    },
    scope: opts?.authorId ? "own" : "all",
  };
}

export async function purgeOldPageViews(): Promise<number> {
  const env = getEnv();
  const cutoff = new Date(Date.now() - env.ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const db = getDb();
  const result = await db.deleteFrom("page_views").where("created_at", "<", cutoff).executeTakeFirst();
  return Number(result.numDeletedRows || 0);
}
