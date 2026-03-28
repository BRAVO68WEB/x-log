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

const ACTIVITYPUB_ACCEPT_HEADER =
  'application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildRemoteActorCandidates(actorUrl: string): string[] {
  const candidates = new Set<string>();

  const add = (value: string) => {
    if (value.startsWith("https://")) {
      candidates.add(value);
    }
  };

  try {
    const url = new URL(actorUrl);
    url.hash = "";

    add(url.toString());

    const withoutSlash = new URL(url.toString());
    withoutSlash.pathname = trimTrailingSlash(withoutSlash.pathname) || "/";
    add(withoutSlash.toString());

    const withSlash = new URL(withoutSlash.toString());
    if (!withSlash.pathname.endsWith("/")) {
      withSlash.pathname = `${withSlash.pathname}/`;
      add(withSlash.toString());
    }

    const hostVariants = new Set<string>([url.hostname]);
    if (url.hostname.startsWith("www.")) {
      hostVariants.add(url.hostname.slice(4));
    } else {
      hostVariants.add(`www.${url.hostname}`);
    }

    for (const hostname of hostVariants) {
      const variant = new URL(withoutSlash.toString());
      variant.hostname = hostname;
      add(variant.toString());

      const variantWithSlash = new URL(variant.toString());
      if (!variantWithSlash.pathname.endsWith("/")) {
        variantWithSlash.pathname = `${variantWithSlash.pathname}/`;
        add(variantWithSlash.toString());
      }
    }
  } catch {
    add(actorUrl);
  }

  return [...candidates];
}

function computeDigest(body: string): string {
  return `SHA-256=${crypto.createHash("sha256").update(body).digest("base64")}`;
}

// Fetch a remote actor's inbox URL by dereferencing their actor object
async function fetchRemoteActor(actorUrl: string): Promise<{
  inbox: string;
  sharedInbox?: string;
  preferredUsername?: string;
}> {
  for (const candidate of buildRemoteActorCandidates(actorUrl)) {
    try {
      const resp = await fetch(candidate, {
        headers: { Accept: ACTIVITYPUB_ACCEPT_HEADER },
      });
      if (resp.ok) {
        const actor = (await resp.json()) as {
          inbox?: string;
          endpoints?: { sharedInbox?: string };
          preferredUsername?: string;
        };
        return {
          inbox: actor.inbox || candidate.replace(/\/$/, "") + "/inbox",
          sharedInbox: actor.endpoints?.sharedInbox,
          preferredUsername: actor.preferredUsername,
        };
      }
    } catch (err) {
      console.error("Failed to fetch remote actor:", err);
    }
  }
  return { inbox: actorUrl.replace(/\/$/, "") + "/inbox" };
}

// Shared inbox activity processing
async function processInboxActivity(
  activity: any,
  userId: string,
  username: string,
  db: ReturnType<typeof getDb>
) {
  // Validate attributedTo on Create activities
  if (activity.type === "Create") {
    const obj = activity.object;
    if (obj && typeof obj === "object" && obj.attributedTo !== activity.actor) {
      console.warn("Create attributedTo mismatch:", obj.attributedTo, "vs", activity.actor);
      return;
    }
  }

  // Handle Follow activity
  if (activity.type === "Follow") {
    const remoteActor = activity.actor;
    const { inbox, sharedInbox, preferredUsername } = await fetchRemoteActor(remoteActor);
    const inboxUrl = sharedInbox || inbox;
    const remoteDomain = new URL(remoteActor).hostname;

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
          remote_username: preferredUsername || null,
          remote_domain: remoteDomain,
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
    const resolvedObjectId = typeof objectId === "string" ? objectId : objectId?.id;

    // Check for duplicate like from same actor
    if (resolvedObjectId) {
      const existingLike = await db
        .selectFrom("inbox_objects")
        .select("id")
        .where("type", "=", "Like")
        .where("actor", "=", activity.actor)
        .where("object_id", "=", resolvedObjectId)
        .executeTakeFirst();
      if (existingLike) return;
    }

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

  // Handle Announce (boost/reblog) - stored as inbox object above
  // No additional processing needed currently; can be extended to track boosts.
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
    // Check if this was a previously published post (now deleted) → 410 Gone
    const settings410 = await getInstanceSettings();
    const apObjectId = `https://${settings410.instance_domain}/post/${id}`;
    const wasPublished = await db
      .selectFrom("outbox_activities")
      .select("id")
      .where("object_id", "=", apObjectId)
      .executeTakeFirst();
    if (wasPublished) {
      return c.json({
        "@context": "https://www.w3.org/ns/activitystreams",
        id: apObjectId,
        type: "Tombstone",
        formerType: "Article",
        deleted: new Date().toISOString(),
      }, 410, { "Content-Type": "application/activity+json" });
    }
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

    const activityId = `https://${settings.instance_domain}/ap/activities/create/${post.id}`;
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
  const db = getDb();
  const settings = await getInstanceSettings();
  const followingId = getFollowingUrlSync(username, settings.instance_domain);

  // If following is disabled, return empty collection
  if (!settings.following_enabled) {
    const user = await db
      .selectFrom("users")
      .select("id")
      .where("username", "=", username)
      .executeTakeFirst();
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json({
      "@context": "https://www.w3.org/ns/activitystreams",
      id: followingId,
      type: "OrderedCollection",
      totalItems: 0,
      orderedItems: [],
    }, 200, {
      "Content-Type": "application/activity+json",
      "Cache-Control": "max-age=60",
    });
  }

  const page = c.req.query("page");
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

  // Validate Content-Type
  const ct = c.req.header("content-type") || "";
  if (!ct.includes("application/activity+json") && !ct.includes("application/ld+json") && !ct.includes("application/json")) {
    console.warn(`Inbox rejected: unsupported content-type: ${ct}`);
    return c.json({ error: "Unsupported content type" }, 415);
  }

  // Require HTTP Signature on all inbox POSTs
  const signatureHeader = c.req.header("signature");
  if (!signatureHeader) {
    console.warn(`Inbox rejected: missing Signature header for /ap/users/${username}/inbox`);
    return c.json({ error: "Missing signature" }, 401);
  }

  // Payload size limit (1MB)
  const body = await c.req.text();
  if (body.length > 1_048_576) {
    console.warn(`Inbox rejected: payload too large (${body.length} bytes)`);
    return c.json({ error: "Payload too large" }, 413);
  }

  const activity = JSON.parse(body);

  // Verify HTTP Signature
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
    console.warn(`Inbox rejected: signature verification failed for ${activity.actor} (type=${activity.type})`);
    return c.json({ error: "Invalid signature" }, 401);
  }

  // Validate actor domain matches signer domain
  const sigKeyId = signatureHeader.match(/keyId="([^"]+)"/)?.[1];
  const sigActorDomain = sigKeyId ? new URL(sigKeyId.replace(/#.*$/, "")).hostname : null;
  const activityActorDomain = activity.actor ? new URL(activity.actor).hostname : null;
  if (!sigActorDomain || sigActorDomain !== activityActorDomain) {
    console.warn(`Inbox rejected: domain mismatch signer=${sigActorDomain} actor=${activityActorDomain}`);
    return c.json({ error: "Actor/signature domain mismatch" }, 403);
  }

  const user = await db
    .selectFrom("users")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Activity ID deduplication
  if (activity.id) {
    const existing = await db
      .selectFrom("inbox_objects")
      .select("id")
      .where("object_id", "=", activity.id)
      .executeTakeFirst();
    if (existing) {
      return c.json({ success: true }, 202);
    }
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

  // Validate Content-Type
  const ct = c.req.header("content-type") || "";
  if (!ct.includes("application/activity+json") && !ct.includes("application/ld+json") && !ct.includes("application/json")) {
    console.warn(`Inbox rejected: unsupported content-type: ${ct}`);
    return c.json({ error: "Unsupported content type" }, 415);
  }

  // Require HTTP Signature on all inbox POSTs
  const signatureHeader = c.req.header("signature");
  if (!signatureHeader) {
    console.warn("Inbox rejected: missing Signature header for /ap/inbox");
    return c.json({ error: "Missing signature" }, 401);
  }

  // Payload size limit (1MB)
  const body = await c.req.text();
  if (body.length > 1_048_576) {
    console.warn(`Inbox rejected: payload too large (${body.length} bytes)`);
    return c.json({ error: "Payload too large" }, 413);
  }

  const activity = JSON.parse(body);

  // Verify HTTP Signature
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
    console.warn(`Inbox rejected: signature verification failed for ${activity.actor} (type=${activity.type})`);
    return c.json({ error: "Invalid signature" }, 401);
  }

  // Validate actor domain matches signer domain
  const sigKeyId = signatureHeader.match(/keyId="([^"]+)"/)?.[1];
  const sigActorDomain = sigKeyId ? new URL(sigKeyId.replace(/#.*$/, "")).hostname : null;
  const activityActorDomain = activity.actor ? new URL(activity.actor).hostname : null;
  if (!sigActorDomain || sigActorDomain !== activityActorDomain) {
    console.warn(`Inbox rejected: domain mismatch signer=${sigActorDomain} actor=${activityActorDomain}`);
    return c.json({ error: "Actor/signature domain mismatch" }, 403);
  }

  // Activity ID deduplication
  if (activity.id) {
    const existing = await db
      .selectFrom("inbox_objects")
      .select("id")
      .where("object_id", "=", activity.id)
      .executeTakeFirst();
    if (existing) {
      return c.json({ success: true }, 202);
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
