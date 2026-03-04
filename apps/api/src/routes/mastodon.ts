import { Hono } from "hono";
import { getDb, getInstanceSettings } from "@xlog/db";

export const mastodonRoutes = new Hono();

// GET /v1/directory — Mastodon-compatible user directory
mastodonRoutes.get("/directory", async (c) => {
  const limit = Math.min(Math.max(1, parseInt(c.req.query("limit") || "40", 10) || 40), 80);
  const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0);
  const db = getDb();
  const settings = await getInstanceSettings();
  const domain = settings.instance_domain;

  const users = await db
    .selectFrom("users")
    .innerJoin("user_profiles", "user_profiles.user_id", "users.id")
    .select([
      "users.id",
      "users.username",
      "users.created_at",
      "user_profiles.full_name",
      "user_profiles.bio",
      "user_profiles.avatar_url",
      "user_profiles.banner_url",
    ])
    .orderBy("users.created_at", "desc")
    .limit(limit)
    .offset(offset)
    .execute();

  const accounts = await Promise.all(
    users.map(async (user) => {
      const followerCount = await db
        .selectFrom("followers")
        .select(db.fn.countAll().as("count"))
        .where("local_user_id", "=", user.id)
        .where("approved", "=", true)
        .executeTakeFirst();

      const followingCount = await db
        .selectFrom("following")
        .select(db.fn.countAll().as("count"))
        .where("local_user_id", "=", user.id)
        .where("accepted", "=", true)
        .executeTakeFirst();

      const statusesCount = await db
        .selectFrom("posts")
        .select(db.fn.countAll().as("count"))
        .where("author_id", "=", user.id)
        .where("published_at", "is not", null)
        .executeTakeFirst();

      return {
        id: user.id,
        username: user.username,
        acct: user.username,
        display_name: user.full_name || user.username,
        locked: false,
        bot: false,
        discoverable: true,
        created_at: user.created_at,
        note: user.bio || "",
        url: `https://${domain}/u/${user.username}`,
        avatar: user.avatar_url || "",
        avatar_static: user.avatar_url || "",
        header: user.banner_url || "",
        header_static: user.banner_url || "",
        followers_count: Number(followerCount?.count || 0),
        following_count: Number(followingCount?.count || 0),
        statuses_count: Number(statusesCount?.count || 0),
        emojis: [],
        fields: [],
      };
    })
  );

  return c.json(accounts);
});

// GET /v1/instance/activity — Weekly activity stats for last 12 weeks
mastodonRoutes.get("/instance/activity", async (c) => {
  const db = getDb();
  const now = new Date();
  const weeks: { week: string; statuses: string; logins: string; registrations: string }[] = [];

  for (let i = 0; i < 12; i++) {
    const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekTimestamp = Math.floor(weekStart.getTime() / 1000).toString();

    const statusesCount = await db
      .selectFrom("posts")
      .select(db.fn.countAll().as("count"))
      .where("published_at", ">=", weekStart)
      .where("published_at", "<", weekEnd)
      .executeTakeFirst();

    const registrationsCount = await db
      .selectFrom("users")
      .select(db.fn.countAll().as("count"))
      .where("created_at", ">=", weekStart)
      .where("created_at", "<", weekEnd)
      .executeTakeFirst();

    weeks.push({
      week: weekTimestamp,
      statuses: String(Number(statusesCount?.count || 0)),
      logins: String(Number(registrationsCount?.count || 0)),
      registrations: String(Number(registrationsCount?.count || 0)),
    });
  }

  return c.json(weeks);
});
