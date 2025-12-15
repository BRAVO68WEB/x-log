import { Hono } from "hono";
import { getDb, getInstanceSettings } from "@xlog/db";
import {
  getActorUrlSync,
  createActorObjectSync,
  getOutboxUrlSync,
  getFollowersUrlSync,
  getFollowingUrlSync,
  createArticleObjectSync,
  createCreateActivity,
  verifySignature,
  createAcceptActivity,
  signRequest,
} from "@xlog/ap";
import { renderMarkdownSync } from "@xlog/markdown";

export const federationRoutes = new Hono();

// Actor endpoint
federationRoutes.get("/ap/users/:username", async (c) => {
  const username = c.req.param("username");
  const db = getDb();

  const user = await db
    .selectFrom("users")
    .innerJoin("user_profiles", "user_profiles.user_id", "users.id")
    .innerJoin("user_keys", "user_keys.user_id", "users.id")
    .select([
      "users.username",
      "user_profiles.full_name",
      "user_profiles.bio",
      "user_keys.public_key_pem",
    ])
    .where("users.username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const summary = user.bio || "";
  const settings = await getInstanceSettings();
  const actor = createActorObjectSync(
    username,
    user.full_name || username,
    summary,
    user.public_key_pem,
    settings.instance_domain
  );

  return c.json(actor, 200, {
    "Content-Type": "application/activity+json",
  });
});

// Outbox endpoint
federationRoutes.get("/ap/users/:username/outbox", async (c) => {
  const username = c.req.param("username");
  const db = getDb();
  const settings = await getInstanceSettings();

  const user = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const posts = await db
    .selectFrom("posts")
    .selectAll()
    .where("author_id", "=", user.id)
    .where("published_at", "is not", null)
    .orderBy("published_at", "desc")
    .limit(20)
    .execute();

  const actorId = getActorUrlSync(username, settings.instance_domain);
  const outboxId = getOutboxUrlSync(username, settings.instance_domain);

  const activities = await Promise.all(
    posts.map(async (post) => {
      const contentHtml = renderMarkdownSync(post.content_markdown);
      const article = createArticleObjectSync(
        post.id,
        actorId,
        post.title,
        contentHtml,
        post.published_at!,
        post.hashtags,
        settings.instance_domain,
        post.summary || undefined,
        post.banner_url
      );

      const activityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;
      return createCreateActivity(
        activityId,
        actorId,
        article,
        post.published_at!
      );
    })
  );

  const collection = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: outboxId,
    type: "OrderedCollection",
    totalItems: posts.length,
    orderedItems: activities,
  };

  return c.json(collection, 200, {
    "Content-Type": "application/activity+json",
  });
});

// Followers endpoint
federationRoutes.get("/ap/users/:username/followers", async (c) => {
  const username = c.req.param("username");
  const db = getDb();

  const user = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const followers = await db
    .selectFrom("followers")
    .select("remote_actor")
    .where("local_user_id", "=", user.id)
    .where("approved", "=", true)
    .execute();

  const settings = await getInstanceSettings();
  const followersId = getFollowersUrlSync(username, settings.instance_domain);
  const collection = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: followersId,
    type: "OrderedCollection",
    totalItems: followers.length,
    items: followers.map((f) => f.remote_actor),
  };

  return c.json(collection, 200, {
    "Content-Type": "application/activity+json",
  });
});

// Following endpoint
federationRoutes.get("/ap/users/:username/following", async (c) => {
  const username = c.req.param("username");
  const db = getDb();
  const settings = await getInstanceSettings();
  const followingId = getFollowingUrlSync(username, settings.instance_domain);

  const user = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const following = await db
    .selectFrom("following")
    .select("remote_actor")
    .where("local_user_id", "=", user.id)
    .where("accepted", "=", true)
    .execute();

  const collection = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: followingId,
    type: "OrderedCollection",
    totalItems: following.length,
    items: following.map((f) => f.remote_actor),
  };

  return c.json(collection, 200, {
    "Content-Type": "application/activity+json",
  });
});

// Inbox endpoint
federationRoutes.post("/ap/users/:username/inbox", async (c) => {
  const username = c.req.param("username");
  const db = getDb();

  // Verify HTTP Signature
  const signatureHeader = c.req.header("signature");
  const body = await c.req.text();
  const activity = JSON.parse(body);

  if (signatureHeader) {
    // Convert headers to plain object
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const isValid = await verifySignature(
      "POST",
      `/ap/users/${username}/inbox`,
      headers,
      signatureHeader,
      body
    );

    if (!isValid) {
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  const user = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Store inbox object
  await db
    .insertInto("inbox_objects")
    .values({
      id: crypto.randomUUID(),
      type: activity.type,
      actor: activity.actor,
      object_id: activity.object?.id || activity.id,
      raw: activity as any,
    })
    .execute();

  // Handle Follow activity
  if (activity.type === "Follow") {
    const remoteActor = activity.actor;
    const inboxUrl = activity.actor.replace(/\/$/, "") + "/inbox";

    // Check if already following
    const existing = await db
      .selectFrom("followers")
      .select("id")
      .where("local_user_id", "=", user.id)
      .where("remote_actor", "=", remoteActor)
      .executeTakeFirst();

    if (!existing) {
      await db
        .insertInto("followers")
        .values({
          id: crypto.randomUUID(),
          local_user_id: user.id,
          remote_actor: remoteActor,
          inbox_url: inboxUrl,
          approved: true,
        })
        .execute();
    }

    try {
      const settings = await getInstanceSettings();
      const actorId = getActorUrlSync(username, settings.instance_domain);

      const acceptActivityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;
      const accept = createAcceptActivity(
        acceptActivityId,
        actorId,
        activity.id
      );

      const acceptBody = JSON.stringify(accept);
      const signature = await signRequest(
        "POST",
        inboxUrl,
        acceptBody,
        user.id
      );

      await fetch(inboxUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/activity+json",
          Signature: signature,
          Date: new Date().toUTCString(),
          Host: new URL(inboxUrl).host,
        },
        body: acceptBody,
      });
    } catch (err) {
      console.error("Failed to send Accept:", err);
    }
  }

  // Handle Like activity
  if (activity.type === "Like") {
    const objectId = activity.object;
    // Extract post ID from object URL
    const postId = objectId.split("/").pop();
    if (postId) {
      await db
        .updateTable("posts")
        .set((eb) => ({
          like_count: eb("like_count", "+", 1),
        }))
        .where("id", "=", postId)
        .execute();
    }
  }

  if (activity.type === "Accept") {
    const objectId = typeof activity.object === "string" ? activity.object : activity.object?.id;
    if (objectId) {
      await db
        .updateTable("following")
        .set({ accepted: true })
        .where("local_user_id", "=", user.id)
        .where("activity_id", "=", objectId)
        .execute();
    }
  }

  // Handle Undo activity
  if (activity.type === "Undo") {
    const obj: any = activity.object;
    if (obj && typeof obj === "object" && obj.type === "Follow") {
      await db
        .deleteFrom("followers")
        .where("local_user_id", "=", user.id)
        .where("remote_actor", "=", activity.actor)
        .execute();
    }
    if (obj && typeof obj === "object" && obj.type === "Like") {
      const likedObject = obj.object as string;
      const postId = likedObject?.split("/").pop();
      if (postId) {
        await db
          .updateTable("posts")
          .set((eb) => ({ like_count: eb("like_count", "-", 1) }))
          .where("id", "=", postId)
          .where("like_count", ">", 0)
          .execute();
      }
    }
  }

  return c.json({ success: true }, 202);
});
