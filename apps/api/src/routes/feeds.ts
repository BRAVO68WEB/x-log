import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { getDb, getInstanceSettings } from "@xlog/db";
import { getPostUrlSync } from "@xlog/ap";
import { renderMarkdownSync } from "@xlog/markdown";

export const feedsRoutes = new Hono();

feedsRoutes.get(
  "/:username/rss",
  describeRoute({
    description: "Get RSS feed for user",
    tags: ["feeds"],
    responses: {
      200: {
        description: "RSS feed",
        content: {
          "application/rss+xml": {
            schema: resolver(z.string()),
          },
        },
      },
    },
  }),
  validator("param", z.object({
    username: z.string(),
  })),
  async (c) => {
    const { username } = c.req.valid("param");
    const db = getDb();
    const settings = await getInstanceSettings();

    const user = await db
      .selectFrom("users")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select(["users.username", "user_profiles.full_name"])
      .where("users.username", "=", username)
      .executeTakeFirst();

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const posts = await db
      .selectFrom("posts")
      .innerJoin("users", "users.id", "posts.author_id")
      .select([
        "posts.id",
        "posts.title",
        "posts.content_markdown",
        "posts.summary",
        "posts.published_at",
        "posts.updated_at",
      ])
      .where("users.username", "=", username)
      .where("posts.visibility", "=", "public")
      .where("posts.published_at", "is not", null)
      .orderBy("posts.published_at", "desc")
      .limit(20)
      .execute();

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${user.full_name || user.username}</title>
    <link>https://${settings.instance_domain}/u/${username}</link>
    <description>Blog posts by ${user.full_name || user.username}</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${posts
      .map(
        (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${getPostUrlSync(post.id, settings.instance_domain)}</link>
      <guid>${getPostUrlSync(post.id, settings.instance_domain)}</guid>
      <description>${escapeXml(post.summary || renderMarkdownSync(post.content_markdown).slice(0, 200))}</description>
      <pubDate>${post.published_at?.toUTCString()}</pubDate>
    </item>`
      )
      .join("")}
  </channel>
</rss>`;

    return c.text(rss, 200, {
      "Content-Type": "application/rss+xml",
    });
  }
);

feedsRoutes.get(
  "/:username/atom",
  describeRoute({
    description: "Get Atom feed for user",
    tags: ["feeds"],
    responses: {
      200: {
        description: "Atom feed",
        content: {
          "application/atom+xml": {
            schema: resolver(z.string()),
          },
        },
      },
    },
  }),
  validator("param", z.object({
    username: z.string(),
  })),
  async (c) => {
    const { username } = c.req.valid("param");
    const db = getDb();
    const settings = await getInstanceSettings();

    const user = await db
      .selectFrom("users")
      .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
      .select(["users.username", "user_profiles.full_name"])
      .where("users.username", "=", username)
      .executeTakeFirst();

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const posts = await db
      .selectFrom("posts")
      .innerJoin("users", "users.id", "posts.author_id")
      .select([
        "posts.id",
        "posts.title",
        "posts.content_markdown",
        "posts.summary",
        "posts.published_at",
        "posts.updated_at",
      ])
      .where("users.username", "=", username)
      .where("posts.visibility", "=", "public")
      .where("posts.published_at", "is not", null)
      .orderBy("posts.published_at", "desc")
      .limit(20)
      .execute();

    const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${user.full_name || user.username}</title>
  <link href="https://${settings.instance_domain}/u/${username}" />
  <id>https://${settings.instance_domain}/u/${username}</id>
  <updated>${posts[0]?.updated_at.toISOString() || new Date().toISOString()}</updated>
  <author>
    <name>${user.full_name || user.username}</name>
  </author>
  ${posts
    .map(
      (post) => `
  <entry>
    <title>${escapeXml(post.title)}</title>
    <link href="${getPostUrlSync(post.id, settings.instance_domain)}" />
    <id>${getPostUrlSync(post.id, settings.instance_domain)}</id>
    <updated>${post.updated_at.toISOString()}</updated>
    <published>${post.published_at?.toISOString()}</published>
    <summary>${escapeXml(post.summary || renderMarkdownSync(post.content_markdown).slice(0, 200))}</summary>
    <content type="html">${escapeXml(renderMarkdownSync(post.content_markdown))}</content>
  </entry>`
    )
    .join("")}
</feed>`;

    return c.text(atom, 200, {
      "Content-Type": "application/atom+xml",
    });
  }
);

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

