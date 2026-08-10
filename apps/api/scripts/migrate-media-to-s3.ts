/**
 * One-shot: upload local ./uploads files to S3-compatible storage.
 *
 * Requires MEDIA_DRIVER=s3 (+ bucket/credentials). Reads files from uploads/,
 * PUTs to S3, updates media.url for matching filenames.
 *
 * Usage (from repo root):
 *   MEDIA_DRIVER=s3 MEDIA_S3_... bun run apps/api/scripts/migrate-media-to-s3.ts
 *   DRY_RUN=true bun run apps/api/scripts/migrate-media-to-s3.ts
 */
import { readdir, readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { getDb } from "@xlog/db";
import { resetMediaStorageCache, getMediaStorage } from "../src/lib/media-storage";
import { getEnv } from "@xlog/config";

const dryRun = process.env.DRY_RUN === "true";

async function main() {
  const env = getEnv();
  if (env.MEDIA_DRIVER !== "s3") {
    console.error("Set MEDIA_DRIVER=s3 before running this script");
    process.exit(1);
  }

  resetMediaStorageCache();
  const storage = await getMediaStorage();
  const dir = join(process.cwd(), "uploads");
  if (!existsSync(dir)) {
    console.log("No uploads/ directory; nothing to do");
    return;
  }

  const files = await readdir(dir);
  console.log(`Found ${files.length} local files (dryRun=${dryRun})`);

  const db = getDb();
  let uploaded = 0;
  let updated = 0;

  for (const filename of files) {
    const filepath = join(dir, filename);
    const st = await stat(filepath);
    if (!st.isFile()) continue;

    const body = await readFile(filepath);
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    const contentType = mimeMap[ext || ""] || "application/octet-stream";

    if (dryRun) {
      console.log(`[dry-run] would upload ${filename} (${st.size} bytes)`);
      continue;
    }

    const { url } = await storage.put({
      key: filename,
      body,
      contentType,
    });
    uploaded += 1;
    console.log(`uploaded ${filename} → ${url}`);

    const result = await db
      .updateTable("media")
      .set({ url })
      .where("filename", "=", filename)
      .executeTakeFirst();
    if (Number(result.numUpdatedRows || 0) > 0) {
      updated += 1;
    }
  }

  console.log(`Done. uploaded=${uploaded} db_url_updated=${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
