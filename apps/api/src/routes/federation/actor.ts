import { Hono } from "hono";
import { getDb, getInstanceSettings } from "@xlog/db";
import {
 getActorUrlSync,
 createActorObjectSync,
 getOutboxUrlSync,
 getFollowersUrlSync,
} from "@xlog/ap";
import { renderMarkdownSync } from "@xlog/markdown";
import { ACTIVITYPUB_ACCEPT_HEADER } from "./shared";

export const actorRoutes = new Hono();

// GET /ap/users/:username — Actor document
actorRoutes.get("/ap/users/:username", async (c) => {
 const username = c.req.param("username");
 const db = getDb();

 const user = await db
 .selectFrom("users")
 .innerJoin("user_profiles", "user_profiles.user_id", "users.id")
 .innerJoin("user_keys", "user_keys.user_id", "users.id")
 .select([
 "users.username",
 "users.created_at",
 "user_profiles.full_name",
 "user_profiles.bio",
 "user_profiles.avatar_url",
 "user_profiles.banner_url",
 "user_keys.public_key_pem",
 ])
 .where("users.username", "=", username)
 .executeTakeFirst();

 if (!user) {
 return c.json({ error: "User not found" }, 404);
 }

 const settings = await getInstanceSettings();
 const actor = createActorObjectSync(
 username,
 user.full_name || username,
 user.bio || "",
 user.public_key_pem,
 settings.instance_domain,
 {
 avatarUrl: user.avatar_url,
 bannerUrl: user.banner_url,
 createdAt: user.created_at,
 }
 );

 return c.json(actor, 200, {
 "Content-Type": "application/activity+json",
 "Cache-Control": "max-age=180",
 });
});

// GET /post/:id — Federated post object (AP content negotiation)
actorRoutes.get("/post/:id", async (c) => {
 const accept = c.req.header("accept") || "";
 const wantsAP =
 accept.includes("application/activity+json") ||
 accept.includes("application/ld+json");

 if (!wantsAP) {
 return c.notFound();
 }

 const id = c.req.param("id");
 const db = getDb();

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
 "posts.updated_at",
 "posts.visibility",
 "users.username",
 ])
 .where("posts.id", "=", id)
 .where("posts.published_at", "is not", null)
 .executeTakeFirst();

 if (!post || !post.published_at) {
 const settings410 = await getInstanceSettings();
 const apObjectId = `https://${settings410.instance_domain}/post/${id}`;
 const wasPublished = await db
 .selectFrom("outbox_activities")
 .select("id")
 .where("object_id", "=", apObjectId)
 .executeTakeFirst();
 if (wasPublished) {
 return c.json(
 {
 "@context": "https://www.w3.org/ns/activitystreams",
 id: apObjectId,
 type: "Tombstone",
 formerType: "Article",
 deleted: new Date().toISOString(),
 },
 410,
 { "Content-Type": "application/activity+json" }
 );
 }
 return c.json({ error: "Not found" }, 404);
 }

 const settings = await getInstanceSettings();
 const actorId = getActorUrlSync(post.username, settings.instance_domain);
 const followersUrl = getFollowersUrlSync(post.username, settings.instance_domain);
 const contentHtml = renderMarkdownSync(post.content_markdown);

 const article = {
 "@context": [
 "https://www.w3.org/ns/activitystreams",
 "https://w3id.org/security/v1",
 ],
 id: `https://${settings.instance_domain}/post/${post.id}`,
 type: "Article",
 attributedTo: actorId,
 name: post.title,
 content: {
 type: "Html",
 content: contentHtml,
 },
 published: post.published_at.toISOString(),
 url: `https://${settings.instance_domain}/post/${post.id}`,
 to: ["https://www.w3.org/ns/activitystreams#Public"],
 cc: [followersUrl],
 summary: post.summary || undefined,
 image: post.banner_url || undefined,
 tag: (post.hashtags || []).map((tag: string) => ({
 type: "Hashtag",
 name: `#${tag}`,
 href: `https://${settings.instance_domain}/search?hashtag=${tag}`,
 })),
 updated: post.updated_at?.toISOString(),
 };

 return c.json(article, 200, {
 "Content-Type": "application/activity+json",
 "Cache-Control": "max-age=180",
 });
});