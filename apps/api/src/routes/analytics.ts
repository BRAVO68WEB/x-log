import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { getDb, getInstanceSettings } from "@xlog/db";
import { sessionMiddleware, requireAuth } from "../middleware/session";
import { generateId } from "@xlog/snowflake";

export const analyticsRoutes = new Hono().use("*", sessionMiddleware);

analyticsRoutes.post(
  "/track",
  describeRoute({
    description: "Track a post view",
    tags: ["analytics"],
    responses: {
      200: {
        description: "View tracked",
      },
    },
  }),
  validator(
    "json",
    z.object({
      post_id: z.string(),
      referrer: z.string().optional(),
    })
  ),
  async (c) => {
    const { post_id, referrer } = c.req.valid("json");
    const userAgent = c.req.header("user-agent");
    const db = getDb();

    // Verify post exists
    const post = await db
      .selectFrom("posts")
      .select("id")
      .where("id", "=", post_id)
      .executeTakeFirst();

    if (!post) {
      return c.json({ error: "Post not found" }, 404);
    }

    // Record the view
    await db
      .insertInto("post_views")
      .values({
        id: generateId(),
        post_id,
        referrer: referrer || null,
        user_agent: userAgent || null,
      })
      .execute();

    return c.json({ message: "View tracked" });
  }
);

analyticsRoutes.get(
  "/post/:id",
  describeRoute({
    description: "Get analytics for a specific post",
    tags: ["analytics"],
    responses: {
      200: {
        description: "Post analytics",
      },
    },
  }),
  validator(
    "param",
    z.object({
      id: z.string(),
    })
  ),
  async (c) => {
    const { id } = c.req.valid("param");
    const db = getDb();

    // Get view count
    const viewCount = await db
      .selectFrom("post_views")
      .select((eb) => eb.fn.count("id").as("count"))
      .where("post_id", "=", id)
      .executeTakeFirst();

    // Get views over time (last 30 days)
    const viewsOverTime = await db
      .selectFrom("post_views")
      .select([db.fn.date("viewed_at").as("date"), db.fn.count("id").as("count")])
      .where("post_id", "=", id)
      .where("viewed_at", ">", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .groupBy("date")
      .orderBy("date", "asc")
      .execute();

    // Get referrers
    const topReferrers = await db
      .selectFrom("post_views")
      .select(["referrer", db.fn.count("id").as("count")])
      .where("post_id", "=", id)
      .where("referrer", "is not", null)
      .groupBy("referrer")
      .orderBy("count", "desc")
      .limit(10)
      .execute();

    return c.json({
      post_id: id,
      total_views: Number(viewCount?.count) || 0,
      views_over_time: viewsOverTime.map((r) => ({
        date: r.date,
        views: Number(r.count),
      })),
      top_referrers: topReferrers.map((r) => ({
        referrer: r.referrer,
        count: Number(r.count),
      })),
    });
  }
);

analyticsRoutes.get(
  "/me",
  describeRoute({
    description: "Get analytics for current user",
    tags: ["analytics"],
    responses: {
      200: {
        description: "User analytics",
      },
    },
  }),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();

    // Get user's posts
    const userPosts = await db
      .selectFrom("posts")
      .select(["id"])
      .where("author_id", "=", user.id)
      .execute();

    const postIds = userPosts.map((p) => p.id);

    // Get total views across all posts
    let totalViews = 0;
    let totalLikes = 0;
    let totalReposts = 0;

    if (postIds.length > 0) {
      const viewResult = await db
        .selectFrom("post_views")
        .select((eb) => eb.fn.count("id").as("count"))
        .where("post_id", "in", postIds)
        .executeTakeFirst();

      totalViews = Number(viewResult?.count) || 0;

      const postStats = await db
        .selectFrom("posts")
        .select([db.fn.sum("like_count").as("total_likes")])
        .where("author_id", "=", user.id)
        .executeTakeFirst();

      totalLikes = Number(postStats?.total_likes) || 0;

      const repostResult = await db
        .selectFrom("posts")
        .select((eb) => eb.fn.count("id").as("count"))
        .where("author_id", "=", user.id)
        .where("repost_of", "is not", null)
        .executeTakeFirst();

      totalReposts = Number(repostResult?.count) || 0;
    }

    // Get follower count
    const followerCount = await db
      .selectFrom("follows")
      .select((eb) => eb.fn.count("id").as("count"))
      .where("target_id", "=", user.id)
      .executeTakeFirst();

    // Get posts count
    const postsCount = await db
      .selectFrom("posts")
      .select((eb) => eb.fn.count("id").as("count"))
      .where("author_id", "=", user.id)
      .where("published_at", "is not", null)
      .executeTakeFirst();

    // Get views over time (last 30 days)
    const viewsOverTime =
      postIds.length > 0
        ? await db
            .selectFrom("post_views")
            .select([db.fn.date("viewed_at").as("date"), db.fn.count("id").as("count")])
            .where("post_id", "in", postIds)
            .where("viewed_at", ">", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
            .groupBy("date")
            .orderBy("date", "asc")
            .execute()
        : [];

    // Get top posts by views
    const topPosts =
      postIds.length > 0
        ? await db
            .selectFrom("posts")
            .innerJoin("users", "users.id", "posts.author_id")
            .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
            .select(["posts.id", "posts.title", db.fn.count("post_views.id").as("views")])
            .leftJoin("post_views", "post_views.post_id", "posts.id")
            .where("posts.author_id", "=", user.id)
            .where("posts.published_at", "is not", null)
            .groupBy("posts.id")
            .orderBy("views", "desc")
            .limit(10)
            .execute()
        : [];

    return c.json({
      user_id: user.id,
      stats: {
        total_views: totalViews,
        total_likes: totalLikes,
        total_reposts: totalReposts,
        total_posts: Number(postsCount?.count) || 0,
        total_followers: Number(followerCount?.count) || 0,
      },
      views_over_time: viewsOverTime.map((r) => ({
        date: r.date,
        views: Number(r.count),
      })),
      top_posts: topPosts.map((p) => ({
        id: p.id,
        title: p.title,
        views: Number(p.views),
      })),
    });
  }
);

analyticsRoutes.get(
  "/me/daily",
  describeRoute({
    description: "Get daily analytics summary for current user",
    tags: ["analytics"],
    responses: {
      200: {
        description: "Daily analytics",
      },
    },
  }),
  validator(
    "query",
    z.object({
      days: z.string().transform(Number).pipe(z.number().int().min(1).max(90)).default("30"),
    })
  ),
  requireAuth,
  async (c) => {
    const user = c.get("user")!;
    const { days } = c.req.valid("query");
    const db = getDb();

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get user's posts
    const userPosts = await db
      .selectFrom("posts")
      .select(["id"])
      .where("author_id", "=", user.id)
      .execute();

    const postIds = userPosts.map((p) => p.id);

    if (postIds.length === 0) {
      return c.json({
        days: [],
        totals: {
          views: 0,
          likes: 0,
          new_posts: 0,
          new_followers: 0,
        },
      });
    }

    // Get daily views
    const dailyViews = await db
      .selectFrom("post_views")
      .select([db.fn.date("viewed_at").as("date"), db.fn.count("id").as("count")])
      .where("post_id", "in", postIds)
      .where("viewed_at", ">", startDate)
      .groupBy("date")
      .execute();

    // Get daily new posts
    const dailyPosts = await db
      .selectFrom("posts")
      .select([db.fn.date("published_at").as("date"), db.fn.count("id").as("count")])
      .where("author_id", "=", user.id)
      .where("published_at", ">", startDate)
      .groupBy("date")
      .execute();

    // Get daily new followers
    const dailyFollowers = await db
      .selectFrom("follows")
      .select([db.fn.date("created_at").as("date"), db.fn.count("id").as("count")])
      .where("target_id", "=", user.id)
      .where("created_at", ">", startDate)
      .groupBy("date")
      .execute();

    // Combine all daily data
    const dailyMap = new Map<string, { views: number; posts: number; followers: number }>();

    for (const row of dailyViews) {
      const date = String(row.date);
      dailyMap.set(date, { views: Number(row.count), posts: 0, followers: 0 });
    }

    for (const row of dailyPosts) {
      const date = String(row.date);
      const existing = dailyMap.get(date) || { views: 0, posts: 0, followers: 0 };
      existing.posts = Number(row.count);
      dailyMap.set(date, existing);
    }

    for (const row of dailyFollowers) {
      const date = String(row.date);
      const existing = dailyMap.get(date) || { views: 0, posts: 0, followers: 0 };
      existing.followers = Number(row.count);
      dailyMap.set(date, existing);
    }

    const dailyData = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        ...stats,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totals = dailyData.reduce(
      (acc, d) => ({
        views: acc.views + d.views,
        likes: acc.likes,
        new_posts: acc.new_posts + d.posts,
        new_followers: acc.new_followers + d.followers,
      }),
      { views: 0, likes: 0, new_posts: 0, new_followers: 0 }
    );

    return c.json({ days: dailyData, totals });
  }
);
