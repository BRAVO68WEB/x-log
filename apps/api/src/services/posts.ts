import { getDb, getInstanceSettings } from "@xlog/db";
import { generateId } from "@xlog/snowflake";
import {
  getActorUrlSync,
  getFollowersUrlSync,
  createDeleteActivity,
} from "@xlog/ap";
import { enqueueDeliveriesToFollowers } from "../lib/redis";

const EMPTY_CONTENT_BLOCKS = {
  type: "doc",
  content: [],
} satisfies Record<string, unknown>;

export type PostActor = { id: string; username: string; role?: string };

export type CreatePostInput = {
  title: string;
  content_markdown: string;
  banner_url?: string | null;
  content_blocks?: Record<string, unknown>;
  hashtags?: string[];
  visibility?: "public" | "unlisted" | "private";
  summary?: string | null;
};

export type UpdatePostInput = Partial<CreatePostInput>;

export class PostServiceError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 = 400
  ) {
    super(message);
    this.name = "PostServiceError";
  }
}

function extractImageUrls(doc: unknown): string[] {
  const urls: string[] = [];
  function walk(node: any) {
    if (!node) return;
    if (node.type === "image" && node.attrs?.src) {
      urls.push(node.attrs.src);
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
    }
  }
  walk(doc);
  return urls;
}

function extractMarkdownImageUrls(markdown?: string | null): string[] {
  if (!markdown) return [];
  const urls: string[] = [];
  const regex = /!\[[^\]]*\]\((https?:\/\/[^)\s]+(?:\s+"[^"]*")?)\)/g;
  for (const match of markdown.matchAll(regex)) {
    const rawUrl = match[1]?.trim();
    if (!rawUrl) continue;
    urls.push(rawUrl.split(/\s+"/)[0]);
  }
  return urls;
}

export async function linkMediaToPost(
  db: ReturnType<typeof getDb>,
  postId: string,
  bannerUrl?: string | null,
  contentBlocks?: unknown,
  markdown?: string | null
) {
  try {
    if (bannerUrl) {
      await db
        .updateTable("media")
        .set({ post_id: postId, asset_type: "banner" })
        .where("url", "=", bannerUrl)
        .where("post_id", "is", null)
        .execute();
    }
    if (contentBlocks && typeof contentBlocks === "object") {
      for (const url of extractImageUrls(contentBlocks)) {
        await db
          .updateTable("media")
          .set({ post_id: postId })
          .where("url", "=", url)
          .where("post_id", "is", null)
          .execute();
      }
    }
    for (const url of extractMarkdownImageUrls(markdown)) {
      await db
        .updateTable("media")
        .set({ post_id: postId })
        .where("url", "=", url)
        .where("post_id", "is", null)
        .execute();
    }
  } catch (err) {
    console.error("Failed to link media to post:", err);
  }
}

function assertCanEdit(
  postAuthorId: string,
  actor: PostActor
): void {
  if (postAuthorId !== actor.id && actor.role !== "admin") {
    throw new PostServiceError("Forbidden", 403);
  }
}

export async function createPost(actor: PostActor, data: CreatePostInput) {
  const db = getDb();
  const settings = await getInstanceSettings();
  const postId = generateId();
  const apObjectId = `https://${settings.instance_domain}/post/${postId}`;
  const hashtags = data.hashtags ?? [];
  const visibility = data.visibility ?? "public";

  await db
    .insertInto("posts")
    .values({
      id: postId,
      author_id: actor.id,
      title: data.title,
      banner_url: data.banner_url || null,
      content_markdown: data.content_markdown,
      content_blocks_json: (data.content_blocks || EMPTY_CONTENT_BLOCKS) as any,
      summary: data.summary || null,
      hashtags,
      visibility,
      ap_object_id: apObjectId,
      like_count: 0,
    })
    .execute();

  await linkMediaToPost(
    db,
    postId,
    data.banner_url,
    data.content_blocks,
    data.content_markdown
  );

  const post = await db
    .selectFrom("posts")
    .innerJoin("users", "users.id", "posts.author_id")
    .leftJoin("user_profiles", "user_profiles.user_id", "users.id")
    .select([
      "posts.id",
      "posts.title",
      "posts.banner_url",
      "posts.content_markdown",
      "posts.summary",
      "posts.hashtags",
      "posts.like_count",
      "posts.published_at",
      "posts.updated_at",
      "posts.visibility",
      "users.username",
      "user_profiles.full_name",
      "user_profiles.avatar_url",
    ])
    .where("posts.id", "=", postId)
    .executeTakeFirstOrThrow();

  return post;
}

export async function updatePost(
  actor: PostActor,
  id: string,
  data: UpdatePostInput
) {
  const db = getDb();
  const post = await db
    .selectFrom("posts")
    .select(["author_id", "published_at", "visibility"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!post) throw new PostServiceError("Post not found", 404);
  assertCanEdit(post.author_id, actor);

  const { content_blocks, ...rest } = data;
  await db
    .updateTable("posts")
    .set({
      ...rest,
      content_blocks_json:
        content_blocks !== undefined
          ? ((content_blocks || EMPTY_CONTENT_BLOCKS) as any)
          : undefined,
    })
    .where("id", "=", id)
    .execute();

  await linkMediaToPost(db, id, data.banner_url, content_blocks, data.content_markdown);

  if (post.published_at && post.visibility !== "private") {
    try {
      const settings = await getInstanceSettings();
      if (settings.federation_enabled) {
        const activityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;
        await enqueueDeliveriesToFollowers(
          post.author_id,
          id,
          activityId,
          "Update",
          settings.instance_domain
        );
      }
    } catch (err) {
      console.error("Failed to enqueue Update deliveries:", err);
    }
  }

  return { id, message: "Post updated" };
}

export async function publishPost(actor: PostActor, id: string) {
  const db = getDb();
  const post = await db
    .selectFrom("posts")
    .select(["author_id", "visibility", "published_at"])
    .where("id", "=", id)
    .executeTakeFirst();

  if (!post) throw new PostServiceError("Post not found", 404);
  assertCanEdit(post.author_id, actor);

  if (post.published_at) {
    return { id, message: "Post already published", published_at: post.published_at };
  }

  const publishedAt = new Date();
  await db
    .updateTable("posts")
    .set({ published_at: publishedAt })
    .where("id", "=", id)
    .execute();

  if (post.visibility !== "private") {
    try {
      const settings = await getInstanceSettings();
      if (settings.federation_enabled) {
        const activityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;
        await enqueueDeliveriesToFollowers(
          post.author_id,
          id,
          activityId,
          "Create",
          settings.instance_domain
        );
      }
    } catch (err) {
      console.error("Failed to enqueue Create deliveries:", err);
    }
  }

  try {
    const { captureServerEvent } = await import("../lib/posthog");
    void captureServerEvent("post_published", {
      post_id: id,
      visibility: post.visibility,
      author_id: post.author_id,
    });
  } catch {
    /* ignore */
  }

  return { id, message: "Post published", published_at: publishedAt };
}

export async function deletePost(actor: PostActor, id: string) {
  const db = getDb();
  const post = await db
    .selectFrom("posts")
    .innerJoin("users", "users.id", "posts.author_id")
    .select([
      "posts.author_id",
      "posts.published_at",
      "posts.visibility",
      "posts.ap_object_id",
      "users.username",
    ])
    .where("posts.id", "=", id)
    .executeTakeFirst();

  if (!post) throw new PostServiceError("Post not found", 404);
  assertCanEdit(post.author_id, actor);

  if (post.published_at && post.visibility !== "private" && post.ap_object_id) {
    try {
      const settings = await getInstanceSettings();
      if (settings.federation_enabled) {
        const actorId = getActorUrlSync(post.username, settings.instance_domain);
        const followersUrl = getFollowersUrlSync(post.username, settings.instance_domain);
        const activityId = `https://${settings.instance_domain}/ap/activities/${crypto.randomUUID()}`;
        const deleteActivity = createDeleteActivity(
          activityId,
          actorId,
          post.ap_object_id,
          followersUrl
        );
        await enqueueDeliveriesToFollowers(
          post.author_id,
          id,
          activityId,
          "Delete",
          settings.instance_domain,
          JSON.stringify(deleteActivity)
        );
      }
    } catch (err) {
      console.error("Failed to enqueue Delete deliveries:", err);
    }
  }

  await db.deleteFrom("posts").where("id", "=", id).execute();
  return { id, message: "Post deleted" };
}
