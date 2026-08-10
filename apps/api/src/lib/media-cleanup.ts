import { getDb } from "@xlog/db";
import { getMediaDriver, getMediaStorage } from "./media-storage";
import { join } from "path";
import { existsSync } from "fs";
import { readdir, stat } from "fs/promises";

export type MediaStats = {
  driver: "local" | "s3";
  total_files: number;
  total_bytes: number;
  linked_files: number;
  orphan_files: number;
  orphan_bytes: number;
  untracked_local: number;
};

export type OrphanMediaItem = {
  filename: string;
  url: string;
  size: number;
  uploaded_at: string;
  mime_type: string;
  source: "db" | "untracked_local";
  user_id: string | null;
};

function uploadDir(): string {
  return join(process.cwd(), "uploads");
}

/**
 * Orphan = media row with post_id null (never linked or unlinked).
 * Optionally only rows older than `olderThanDays`.
 */
export async function listDbOrphans(opts: {
  userId?: string | null;
  isAdmin: boolean;
  olderThanDays?: number;
  limit?: number;
}): Promise<OrphanMediaItem[]> {
  const db = getDb();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  let q = db
    .selectFrom("media")
    .select([
      "filename",
      "url",
      "size",
      "created_at",
      "mime_type",
      "user_id",
    ])
    .where("post_id", "is", null)
    .orderBy("created_at", "asc")
    .limit(limit);

  if (!opts.isAdmin) {
    if (!opts.userId) return [];
    q = q.where("user_id", "=", opts.userId);
  }

  if (opts.olderThanDays !== undefined && opts.olderThanDays > 0) {
    const cutoff = new Date(Date.now() - opts.olderThanDays * 24 * 60 * 60 * 1000);
    q = q.where("created_at", "<", cutoff);
  }

  const rows = await q.execute();
  return rows.map((r) => ({
    filename: r.filename,
    url: r.url,
    size: r.size,
    uploaded_at: r.created_at.toISOString(),
    mime_type: r.mime_type,
    source: "db" as const,
    user_id: r.user_id,
  }));
}

export async function listUntrackedLocalFiles(): Promise<OrphanMediaItem[]> {
  if (getMediaDriver() !== "local") return [];
  const dir = uploadDir();
  if (!existsSync(dir)) return [];

  const db = getDb();
  const tracked = await db.selectFrom("media").select("filename").execute();
  const trackedSet = new Set(tracked.map((t) => t.filename));

  const files = await readdir(dir);
  const out: OrphanMediaItem[] = [];
  for (const filename of files) {
    if (trackedSet.has(filename)) continue;
    if (filename.startsWith(".")) continue;
    try {
      const st = await stat(join(dir, filename));
      if (!st.isFile()) continue;
      out.push({
        filename,
        url: `/api/media/${encodeURIComponent(filename)}`,
        size: st.size,
        uploaded_at: st.mtime.toISOString(),
        mime_type: "application/octet-stream",
        source: "untracked_local",
        user_id: null,
      });
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function getMediaStats(opts: {
  userId?: string | null;
  isAdmin: boolean;
}): Promise<MediaStats> {
  const db = getDb();
  let base = db
    .selectFrom("media")
    .select((eb) => [
      eb.fn.countAll<number>().as("total"),
      eb.fn.sum<number>("size").as("bytes"),
    ]);

  if (!opts.isAdmin && opts.userId) {
    base = base.where("user_id", "=", opts.userId) as typeof base;
  } else if (!opts.isAdmin) {
    return {
      driver: getMediaDriver(),
      total_files: 0,
      total_bytes: 0,
      linked_files: 0,
      orphan_files: 0,
      orphan_bytes: 0,
      untracked_local: 0,
    };
  }

  const totals = await base.executeTakeFirst();

  let orphanQ = db
    .selectFrom("media")
    .select((eb) => [
      eb.fn.countAll<number>().as("total"),
      eb.fn.sum<number>("size").as("bytes"),
    ])
    .where("post_id", "is", null);

  if (!opts.isAdmin && opts.userId) {
    orphanQ = orphanQ.where("user_id", "=", opts.userId) as typeof orphanQ;
  }

  const orphans = await orphanQ.executeTakeFirst();

  let linkedQ = db
    .selectFrom("media")
    .select((eb) => [eb.fn.countAll<number>().as("total")])
    .where("post_id", "is not", null);

  if (!opts.isAdmin && opts.userId) {
    linkedQ = linkedQ.where("user_id", "=", opts.userId) as typeof linkedQ;
  }
  const linked = await linkedQ.executeTakeFirst();

  let untracked = 0;
  if (opts.isAdmin && getMediaDriver() === "local") {
    untracked = (await listUntrackedLocalFiles()).length;
  }

  return {
    driver: getMediaDriver(),
    total_files: Number(totals?.total ?? 0),
    total_bytes: Number(totals?.bytes ?? 0),
    linked_files: Number(linked?.total ?? 0),
    orphan_files: Number(orphans?.total ?? 0),
    orphan_bytes: Number(orphans?.bytes ?? 0),
    untracked_local: untracked,
  };
}

export type CleanupResult = {
  dry_run: boolean;
  deleted: string[];
  failed: Array<{ filename: string; error: string }>;
  skipped: number;
};

/**
 * Delete orphan media (DB rows with null post_id, optionally untracked local files).
 * Authors may only purge their own DB orphans; admins can purge all + untracked.
 */
export async function cleanupOrphanMedia(opts: {
  userId: string;
  isAdmin: boolean;
  dryRun: boolean;
  olderThanDays: number;
  includeUntracked: boolean;
  limit?: number;
}): Promise<CleanupResult> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  const orphans = await listDbOrphans({
    userId: opts.userId,
    isAdmin: opts.isAdmin,
    olderThanDays: opts.olderThanDays,
    limit,
  });

  let candidates = [...orphans];
  if (opts.includeUntracked && opts.isAdmin) {
    const untracked = await listUntrackedLocalFiles();
    const cutoff = Date.now() - opts.olderThanDays * 24 * 60 * 60 * 1000;
    for (const u of untracked) {
      if (new Date(u.uploaded_at).getTime() < cutoff) {
        candidates.push(u);
      }
    }
    candidates = candidates.slice(0, limit);
  }

  const deleted: string[] = [];
  const failed: Array<{ filename: string; error: string }> = [];

  if (opts.dryRun) {
    return {
      dry_run: true,
      deleted: candidates.map((c) => c.filename),
      failed: [],
      skipped: 0,
    };
  }

  const storage = await getMediaStorage();
  const db = getDb();

  for (const item of candidates) {
    try {
      await storage.delete(item.filename);
      if (item.source === "db") {
        await db.deleteFrom("media").where("filename", "=", item.filename).execute();
      }
      deleted.push(item.filename);
    } catch (err) {
      failed.push({
        filename: item.filename,
        error: err instanceof Error ? err.message : "delete failed",
      });
    }
  }

  return {
    dry_run: false,
    deleted,
    failed,
    skipped: 0,
  };
}

/** Build weak ETag for media responses (size + key). */
export function mediaEtag(filename: string, size: number, mtimeMs?: number): string {
  const m = mtimeMs !== undefined ? mtimeMs.toString(16) : "0";
  // Simple non-crypto fingerprint; fine for cache revalidation
  let h = 0;
  const s = `${filename}:${size}:${m}`;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `W/"${size.toString(16)}-${h.toString(16)}"`;
}

export function etagMatches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  const parts = ifNoneMatch.split(",").map((p) => p.trim());
  if (parts.includes("*")) return true;
  return parts.some((p) => p === etag || p === etag.replace(/^W\//, ""));
}
