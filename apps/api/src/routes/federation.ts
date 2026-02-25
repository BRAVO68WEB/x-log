import crypto from "crypto";
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

function computeDigest(body: string): string {
  return `SHA-256=${crypto.createHash("sha256").update(body).digest("base64")}`;
}

// Fetch a remote actor's inbox URL by dereferencing their actor object
async function fetchRemoteInbox(actorUrl: string): Promise<string> {
  try {
    const resp = await fetch(actorUrl, {
      headers: { Accept: "application/activity+json, application/ld+json" },
    });
    if (resp.ok) {
      const actor = (await resp.json()) as { inbox?: string };
      if (actor.inbox) return actor.inbox;
    }
  } catch (err) {
    console.error("Failed to fetch remote actor inbox:", err);
  }
  // Fallback to naive derivation
  return actorUrl.replace(/\/$/, "") + "/inbox";
}

// Shared inbox activity processing
async function processInboxActivity(
  activity: any,
  userId: string,
  username: string,
  db: ReturnType<typeof getDb>
) {
  // Handle Follow activity
  if (activity.type === "Follow") {
    const remoteActor = activity.actor;
    const inboxUrl = await fetchRemoteInbox(remoteActor);

    // Check if already following
    const existing = await db
      .selectFrom("followers")
      .select("id")
      .where("local_user_id", "=", userId)
      .where("remote_actor", "=", remoteActor)
      .executeTakeFirst();

    if (!existing) {
      await db
        .insertInto("followers")
        .values({
          id: crypto.randomUUID(),
          local_user_id: userId,
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
        userId
      );

      await fetch(inboxUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/activity+json",
          Signature: signature,
          Digest: computeDigest(acceptBody),
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
    const postId = typeof objectId === "string" ? objectId.split("/").pop() : null;
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
        .where("local_user_id", "=", userId)
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
        .where("local_user_id", "=", userId)
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

  // Handle Update activity - update stored inbox object
  if (activity.type === "Update") {
    const objectId = activity.object?.id || activity.object;
    if (objectId) {
      await db
        .updateTable("inbox_objects")
        .set({ raw: activity as any })
        .where("object_id", "=", typeof objectId === "string" ? objectId : objectId.id)
        .execute();
    }
  }

  // Handle Delete activity - remove stored inbox object
  if (activity.type === "Delete") {
    const objectId =
      typeof activity.object === "string"
        ? activity.object
        : activity.object?.id;
    if (objectId) {
      await db
        .deleteFrom("inbox_objects")
        .where("object_id", "=", objectId)
        .execute();
    }
  }
}

// Actor endpoint (A8: enriched with avatar, banner, created_at)
federationRoutes.get("/ap/users/:username", async (c) => {
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

  const summary = user.bio || "";
  const settings = await getInstanceSettings();
  const actor = createActorObjectSync(
    username,
    user.full_name || username,
    summary,
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

// Content negotiation on post URLs (A9)
federationRoutes.get("/post/:id", async (c) => {
  const accept = c.req.header("accept") || "";
  const wantsAP =
    accept.includes("application/activity+json") ||
    accept.includes("application/ld+json");

  if (!wantsAP) {
    // Let Next.js handle HTML rendering
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
    return c.json({ error: "Not found" }, 404);
  }

  const settings = await getInstanceSettings();
  const actorId = getActorUrlSync(post.username, settings.instance_domain);
  const followersUrl = getFollowersUrlSync(post.username, settings.instance_domain);
  const contentHtml = renderMarkdownSync(post.content_markdown);

  const article = createArticleObjectSync(
    post.id,
    actorId,
    post.title,
    contentHtml,
    post.published_at,
    post.hashtags,
    settings.instance_domain,
    post.summary || undefined,
    post.banner_url,
    {
      updated: post.updated_at,
      visibility: (post.visibility as "public" | "unlisted" | "private") || "public",
      followersUrl,
    }
  );

  return c.json(article, 200, {
    "Content-Type": "application/activity+json",
    "Cache-Control": "max-age=180",
  });
});

// Outbox endpoint (A10: paginated)
federationRoutes.get("/ap/users/:username/outbox", async (c) => {
  const username = c.req.param("username");
  const page = c.req.query("page");
  const db = getDb();
  const settings = await getInstanceSettings();
  const PAGE_SIZE = 20;

  const user = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const outboxId = getOutboxUrlSync(username, settings.instance_domain);

  // Count total published posts
  const countResult = await db
    .selectFrom("posts")
    .select(db.fn.countAll().as("count"))
    .where("author_id", "=", user.id)
    .where("published_at", "is not", null)
    .executeTakeFirst();
  const totalItems = Number(countResult?.count || 0);

  if (!page) {
    // Return collection summary
    const collection = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: outboxId,
      type: "OrderedCollection",
      totalItems,
      first: `${outboxId}?page=1`,
      last: `${outboxId}?page=${Math.max(1, Math.ceil(totalItems / PAGE_SIZE))}`,
    };
    return c.json(collection, 200, {
      "Content-Type": "application/activity+json",
      "Cache-Control": "max-age=60",
    });
  }

  // Return paginated page
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const posts = await db
    .selectFrom("posts")
    .selectAll()
    .where("author_id", "=", user.id)
    .where("published_at", "is not", null)
    .orderBy("published_at", "desc")
    .limit(PAGE_SIZE)
    .offset(offset)
    .execute();

  const actorId = getActorUrlSync(username, settings.instance_domain);
  const followersUrl = getFollowersUrlSync(username, settings.instance_domain);

  const activities = posts.map((post) => {
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
      post.banner_url,
      { visibility: "public", followersUrl }
    );

    const activityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;
    return createCreateActivity(
      activityId,
      actorId,
      article,
      post.published_at!
    );
  });

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const collectionPage: any = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${outboxId}?page=${pageNum}`,
    type: "OrderedCollectionPage",
    partOf: outboxId,
    orderedItems: activities,
  };

  if (pageNum > 1) {
    collectionPage.prev = `${outboxId}?page=${pageNum - 1}`;
  }
  if (pageNum < totalPages) {
    collectionPage.next = `${outboxId}?page=${pageNum + 1}`;
  }

  return c.json(collectionPage, 200, {
    "Content-Type": "application/activity+json",
    "Cache-Control": "max-age=60",
  });
});

// Followers endpoint (A10: paginated)
federationRoutes.get("/ap/users/:username/followers", async (c) => {
  const username = c.req.param("username");
  const page = c.req.query("page");
  const db = getDb();
  const PAGE_SIZE = 20;

  const user = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const settings = await getInstanceSettings();
  const followersId = getFollowersUrlSync(username, settings.instance_domain);

  const countResult = await db
    .selectFrom("followers")
    .select(db.fn.countAll().as("count"))
    .where("local_user_id", "=", user.id)
    .where("approved", "=", true)
    .executeTakeFirst();
  const totalItems = Number(countResult?.count || 0);

  if (!page) {
    const collection = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: followersId,
      type: "OrderedCollection",
      totalItems,
      first: `${followersId}?page=1`,
      last: `${followersId}?page=${Math.max(1, Math.ceil(totalItems / PAGE_SIZE))}`,
    };
    return c.json(collection, 200, {
      "Content-Type": "application/activity+json",
      "Cache-Control": "max-age=60",
    });
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const followers = await db
    .selectFrom("followers")
    .select("remote_actor")
    .where("local_user_id", "=", user.id)
    .where("approved", "=", true)
    .orderBy("created_at", "desc")
    .limit(PAGE_SIZE)
    .offset(offset)
    .execute();

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const collectionPage: any = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${followersId}?page=${pageNum}`,
    type: "OrderedCollectionPage",
    partOf: followersId,
    orderedItems: followers.map((f) => f.remote_actor),
  };

  if (pageNum > 1) {
    collectionPage.prev = `${followersId}?page=${pageNum - 1}`;
  }
  if (pageNum < totalPages) {
    collectionPage.next = `${followersId}?page=${pageNum + 1}`;
  }

  return c.json(collectionPage, 200, {
    "Content-Type": "application/activity+json",
    "Cache-Control": "max-age=60",
  });
});

// Following endpoint (A10: paginated)
federationRoutes.get("/ap/users/:username/following", async (c) => {
  const username = c.req.param("username");
  const page = c.req.query("page");
  const db = getDb();
  const settings = await getInstanceSettings();
  const followingId = getFollowingUrlSync(username, settings.instance_domain);
  const PAGE_SIZE = 20;

  const user = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const countResult = await db
    .selectFrom("following")
    .select(db.fn.countAll().as("count"))
    .where("local_user_id", "=", user.id)
    .where("accepted", "=", true)
    .executeTakeFirst();
  const totalItems = Number(countResult?.count || 0);

  if (!page) {
    const collection = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: followingId,
      type: "OrderedCollection",
      totalItems,
      first: `${followingId}?page=1`,
      last: `${followingId}?page=${Math.max(1, Math.ceil(totalItems / PAGE_SIZE))}`,
    };
    return c.json(collection, 200, {
      "Content-Type": "application/activity+json",
      "Cache-Control": "max-age=60",
    });
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const following = await db
    .selectFrom("following")
    .select("remote_actor")
    .where("local_user_id", "=", user.id)
    .where("accepted", "=", true)
    .orderBy("created_at", "desc")
    .limit(PAGE_SIZE)
    .offset(offset)
    .execute();

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const collectionPage: any = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${followingId}?page=${pageNum}`,
    type: "OrderedCollectionPage",
    partOf: followingId,
    orderedItems: following.map((f) => f.remote_actor),
  };

  if (pageNum > 1) {
    collectionPage.prev = `${followingId}?page=${pageNum - 1}`;
  }
  if (pageNum < totalPages) {
    collectionPage.next = `${followingId}?page=${pageNum + 1}`;
  }

  return c.json(collectionPage, 200, {
    "Content-Type": "application/activity+json",
    "Cache-Control": "max-age=60",
  });
});

// Per-user Inbox endpoint
federationRoutes.post("/ap/users/:username/inbox", async (c) => {
  const username = c.req.param("username");
  const db = getDb();

  // Verify HTTP Signature
  const signatureHeader = c.req.header("signature");
  const body = await c.req.text();
  const activity = JSON.parse(body);

  if (signatureHeader) {
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

  await processInboxActivity(activity, user.id, username, db);

  return c.json({ success: true }, 202);
});

// Shared inbox endpoint (A11)
federationRoutes.post("/ap/inbox", async (c) => {
  const db = getDb();

  const signatureHeader = c.req.header("signature");
  const body = await c.req.text();
  const activity = JSON.parse(body);

  if (signatureHeader) {
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const isValid = await verifySignature(
      "POST",
      `/ap/inbox`,
      headers,
      signatureHeader,
      body
    );

    if (!isValid) {
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  // Parse to/cc to find targeted local users
  const recipients = [
    ...(Array.isArray(activity.to) ? activity.to : []),
    ...(Array.isArray(activity.cc) ? activity.cc : []),
  ];

  // Extract local usernames from actor URLs
  const settings = await getInstanceSettings();
  const localPrefix = `https://${settings.instance_domain}/ap/users/`;
  const targetedUsernames = recipients
    .filter((r: string) => typeof r === "string" && r.startsWith(localPrefix))
    .map((r: string) => r.slice(localPrefix.length));

  // If targeting public or followers collections, find all local followers of the sender
  const isPublic = recipients.includes("https://www.w3.org/ns/activitystreams#Public");
  if (isPublic || targetedUsernames.length === 0) {
    // Find local users who follow the sender
    const followRows = await db
      .selectFrom("followers")
      .innerJoin("users", "users.id", "followers.local_user_id")
      .select(["users.id", "users.username"])
      .where("followers.remote_actor", "=", activity.actor)
      .where("followers.approved", "=", true)
      .execute();

    for (const row of followRows) {
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

      await processInboxActivity(activity, row.id, row.username, db);
    }
  } else {
    // Process for each specifically targeted local user
    for (const uname of targetedUsernames) {
      const user = await db
        .selectFrom("users")
        .select("id")
        .where("username", "=", uname)
        .executeTakeFirst();

      if (user) {
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

        await processInboxActivity(activity, user.id, uname, db);
      }
    }
  }

  return c.json({ success: true }, 202);
});
