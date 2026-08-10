import { getDb } from "@xlog/db";

/** Avoid circular import with posts.ts — mirror the same actor shape. */
export type VersionActor = { id: string; username: string; role?: string };

export class PostVersionError extends Error {
  constructor(
    message: string,
    public status: 400 | 403 | 404 = 400
  ) {
    super(message);
    this.name = "PostVersionError";
  }
}

function assertCanEdit(postAuthorId: string, actor: VersionActor): void {
  if (postAuthorId !== actor.id && actor.role !== "admin") {
    throw new PostVersionError("Forbidden", 403);
  }
}

export const MAX_POST_VERSIONS = 50;

export type PostVersionSnapshot = {
  title: string;
  content_markdown: string;
  content_blocks_json: Record<string, unknown>;
  summary: string | null;
  banner_url: string | null;
  hashtags: string[];
};

export type PostVersionListItem = {
  version: number;
  title: string;
  changelog: string | null;
  created_by: string | null;
  created_at: string;
  is_current: boolean;
};

/** True when an update should allocate a new version number. */
export function shouldCreatePostVersion(
  previous: PostVersionSnapshot,
  next: Partial<PostVersionSnapshot>
): boolean {
  if (next.title !== undefined && next.title !== previous.title) return true;
  if (
    next.content_markdown !== undefined &&
    next.content_markdown !== previous.content_markdown
  ) {
    return true;
  }
  if (next.summary !== undefined && next.summary !== previous.summary) return true;
  if (next.banner_url !== undefined && next.banner_url !== previous.banner_url) {
    return true;
  }
  if (next.hashtags !== undefined) {
    const a = [...previous.hashtags].sort().join("\0");
    const b = [...next.hashtags].sort().join("\0");
    if (a !== b) return true;
  }
  if (next.content_blocks_json !== undefined) {
    try {
      if (
        JSON.stringify(next.content_blocks_json) !==
        JSON.stringify(previous.content_blocks_json)
      ) {
        return true;
      }
    } catch {
      return true;
    }
  }
  return false;
}

async function pruneOldVersions(postId: string) {
  const db = getDb();
  const rows = await db
    .selectFrom("post_versions")
    .select("version")
    .where("post_id", "=", postId)
    .orderBy("version", "desc")
    .execute();

  if (rows.length <= MAX_POST_VERSIONS) return;

  const keep = new Set(rows.slice(0, MAX_POST_VERSIONS).map((r) => r.version));
  const drop = rows.filter((r) => !keep.has(r.version)).map((r) => r.version);
  if (drop.length === 0) return;

  await db
    .deleteFrom("post_versions")
    .where("post_id", "=", postId)
    .where("version", "in", drop)
    .execute();
}

export async function insertPostVersion(
  postId: string,
  version: number,
  snapshot: PostVersionSnapshot,
  opts?: { changelog?: string | null; createdBy?: string | null }
) {
  const db = getDb();
  await db
    .insertInto("post_versions")
    .values({
      id: crypto.randomUUID(),
      post_id: postId,
      version,
      title: snapshot.title,
      content_markdown: snapshot.content_markdown,
      content_blocks_json: snapshot.content_blocks_json as any,
      summary: snapshot.summary,
      banner_url: snapshot.banner_url,
      hashtags: snapshot.hashtags,
      changelog: opts?.changelog ?? null,
      created_by: opts?.createdBy ?? null,
    })
    .execute();

  await pruneOldVersions(postId);
}

export async function listPostVersions(
  actor: VersionActor,
  postId: string
): Promise<{ current_version: number; items: PostVersionListItem[] }> {
  const db = getDb();
  const post = await db
    .selectFrom("posts")
    .select(["author_id", "current_version"])
    .where("id", "=", postId)
    .executeTakeFirst();

  if (!post) throw new PostVersionError("Post not found", 404);
  assertCanEdit(post.author_id, actor);

  const rows = await db
    .selectFrom("post_versions")
    .select(["version", "title", "changelog", "created_by", "created_at"])
    .where("post_id", "=", postId)
    .orderBy("version", "desc")
    .execute();

  return {
    current_version: post.current_version,
    items: rows.map((r) => ({
      version: r.version,
      title: r.title,
      changelog: r.changelog,
      created_by: r.created_by,
      created_at: r.created_at.toISOString(),
      is_current: r.version === post.current_version,
    })),
  };
}

export async function getPostVersion(
  actor: VersionActor,
  postId: string,
  version: number
) {
  const db = getDb();
  const post = await db
    .selectFrom("posts")
    .select(["author_id", "current_version"])
    .where("id", "=", postId)
    .executeTakeFirst();

  if (!post) throw new PostVersionError("Post not found", 404);
  assertCanEdit(post.author_id, actor);

  const row = await db
    .selectFrom("post_versions")
    .selectAll()
    .where("post_id", "=", postId)
    .where("version", "=", version)
    .executeTakeFirst();

  if (!row) throw new PostVersionError("Version not found", 404);

  return {
    version: row.version,
    title: row.title,
    content_markdown: row.content_markdown,
    content_blocks_json: row.content_blocks_json as Record<string, unknown>,
    summary: row.summary,
    banner_url: row.banner_url,
    hashtags: row.hashtags,
    changelog: row.changelog,
    created_by: row.created_by,
    created_at: row.created_at.toISOString(),
    is_current: row.version === post.current_version,
  };
}

/**
 * Restore a historical version as a new current version (does not delete history).
 */
export async function restorePostVersion(
  actor: VersionActor,
  postId: string,
  version: number
) {
  const db = getDb();
  const post = await db
    .selectFrom("posts")
    .select([
      "author_id",
      "current_version",
      "published_at",
      "visibility",
    ])
    .where("id", "=", postId)
    .executeTakeFirst();

  if (!post) throw new PostVersionError("Post not found", 404);
  assertCanEdit(post.author_id, actor);

  const snapshot = await db
    .selectFrom("post_versions")
    .selectAll()
    .where("post_id", "=", postId)
    .where("version", "=", version)
    .executeTakeFirst();

  if (!snapshot) throw new PostVersionError("Version not found", 404);

  const newVersion = post.current_version + 1;
  const restored: PostVersionSnapshot = {
    title: snapshot.title,
    content_markdown: snapshot.content_markdown,
    content_blocks_json: snapshot.content_blocks_json as Record<string, unknown>,
    summary: snapshot.summary,
    banner_url: snapshot.banner_url,
    hashtags: snapshot.hashtags,
  };

  await db
    .updateTable("posts")
    .set({
      title: restored.title,
      content_markdown: restored.content_markdown,
      content_blocks_json: restored.content_blocks_json as any,
      summary: restored.summary,
      banner_url: restored.banner_url,
      hashtags: restored.hashtags,
      current_version: newVersion,
      updated_at: new Date(),
    })
    .where("id", "=", postId)
    .execute();

  await insertPostVersion(postId, newVersion, restored, {
    changelog: `Restored from v${version}`,
    createdBy: actor.id,
  });

  return {
    id: postId,
    current_version: newVersion,
    restored_from: version,
    message: `Restored content from v${version} as v${newVersion}`,
  };
}
