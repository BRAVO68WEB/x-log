import { getEnv } from "@xlog/config";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

export type PutObjectInput = {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
};

export type MediaStorage = {
  driver: "local" | "s3";
  /** Persist object; returns public URL for clients */
  put(input: PutObjectInput): Promise<{ url: string; key: string }>;
  /** Delete by storage key (filename) */
  delete(key: string): Promise<void>;
  /**
   * Read object bytes for local serving. S3 with public URL may return null
   * (caller should redirect).
   */
  get(key: string): Promise<{ body: Buffer; contentType: string } | null>;
  /** Public URL for an existing key */
  publicUrl(key: string): string;
  /** List keys (local untracked scan only; s3 returns empty) */
  listLocalFilenames?(): Promise<string[]>;
};

function sanitizeFilename(name: string): string {
  // Prevent path traversal; keep extension
  const base = name.replace(/[/\\]/g, "_").replace(/\.\./g, "_");
  return base.slice(0, 200) || "file";
}

export function makeObjectKey(originalName: string): string {
  const safe = sanitizeFilename(originalName);
  return `${crypto.randomUUID()}-${safe}`;
}

function localUploadDir(): string {
  return join(process.cwd(), "uploads");
}

async function createLocalStorage(): Promise<MediaStorage> {
  const dir = localUploadDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const { getInstanceSettings } = await import("@xlog/db");

  return {
    driver: "local",
    async put({ key, body, contentType }) {
      const filepath = join(dir, key);
      await writeFile(filepath, body);
      const settings = await getInstanceSettings();
      const isDev = process.env.NODE_ENV === "development";
      const url = isDev
        ? `http://${settings.instance_domain}/api/media/${encodeURIComponent(key)}`
        : `https://${settings.instance_domain}/api/media/${encodeURIComponent(key)}`;
      return { url, key };
    },
    async delete(key) {
      const filepath = join(dir, key);
      if (existsSync(filepath)) await unlink(filepath);
    },
    async get(key) {
      const filepath = join(dir, key);
      if (!existsSync(filepath)) return null;
      const body = await readFile(filepath);
      // naive mime from extension
      const ext = key.split(".").pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
      };
      return { body, contentType: mimeMap[ext || ""] || "application/octet-stream" };
    },
    publicUrl(key) {
      // filled async via put; for list we rebuild
      const isDev = process.env.NODE_ENV === "development";
      // best-effort without settings
      return isDev ? `/api/media/${encodeURIComponent(key)}` : `/api/media/${encodeURIComponent(key)}`;
    },
    async listLocalFilenames() {
      if (!existsSync(dir)) return [];
      return readdir(dir);
    },
  };
}

async function createS3Storage(): Promise<MediaStorage> {
  const env = getEnv();
  if (!env.MEDIA_S3_BUCKET || !env.MEDIA_S3_ACCESS_KEY_ID || !env.MEDIA_S3_SECRET_ACCESS_KEY) {
    throw new Error(
      "MEDIA_DRIVER=s3 requires MEDIA_S3_BUCKET, MEDIA_S3_ACCESS_KEY_ID, MEDIA_S3_SECRET_ACCESS_KEY"
    );
  }

  const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = await import(
    "@aws-sdk/client-s3"
  );

  const forcePathStyle =
    env.MEDIA_S3_FORCE_PATH_STYLE ?? Boolean(env.MEDIA_S3_ENDPOINT);

  const client = new S3Client({
    region: env.MEDIA_S3_REGION || "auto",
    endpoint: env.MEDIA_S3_ENDPOINT || undefined,
    forcePathStyle,
    credentials: {
      accessKeyId: env.MEDIA_S3_ACCESS_KEY_ID,
      secretAccessKey: env.MEDIA_S3_SECRET_ACCESS_KEY,
    },
  });

  const bucket = env.MEDIA_S3_BUCKET;
  let prefix = (env.MEDIA_S3_PREFIX || "").replace(/^\/+/, "");
  if (prefix && !prefix.endsWith("/")) prefix += "/";

  function fullKey(key: string): string {
    return `${prefix}${key}`;
  }

  function buildPublicUrl(key: string): string {
    if (env.MEDIA_S3_PUBLIC_URL) {
      return `${env.MEDIA_S3_PUBLIC_URL.replace(/\/$/, "")}/${fullKey(key)}`;
    }
    // Fallback: serve through API (proxied GetObject)
    const isDev = process.env.NODE_ENV === "development";
    // domain resolved at put time if needed
    return isDev
      ? `http://localhost:${env.PORT}/api/media/${encodeURIComponent(key)}`
      : `/api/media/${encodeURIComponent(key)}`;
  }

  return {
    driver: "s3",
    async put({ key, body, contentType }) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: fullKey(key),
          Body: body,
          ContentType: contentType,
          // Public-read when using public URL; R2 often uses bucket policy instead
          // ACL omitted for R2 compatibility
        })
      );

      let url = buildPublicUrl(key);
      if (!env.MEDIA_S3_PUBLIC_URL) {
        const { getInstanceSettings } = await import("@xlog/db");
        const settings = await getInstanceSettings();
        const isDev = process.env.NODE_ENV === "development";
        url = isDev
          ? `http://${settings.instance_domain}/api/media/${encodeURIComponent(key)}`
          : `https://${settings.instance_domain}/api/media/${encodeURIComponent(key)}`;
      }
      return { url, key };
    },
    async delete(key) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: fullKey(key),
        })
      );
    },
    async get(key) {
      // Prefer public redirect; still support proxy for private buckets
      try {
        const out = await client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: fullKey(key),
          })
        );
        const bytes = await out.Body?.transformToByteArray();
        if (!bytes) return null;
        return {
          body: Buffer.from(bytes),
          contentType: out.ContentType || "application/octet-stream",
        };
      } catch {
        return null;
      }
    },
    publicUrl(key) {
      return buildPublicUrl(key);
    },
  };
}

let cached: MediaStorage | null = null;

export async function getMediaStorage(): Promise<MediaStorage> {
  if (cached) return cached;
  const env = getEnv();
  if (env.MEDIA_DRIVER === "s3") {
    cached = await createS3Storage();
  } else {
    cached = await createLocalStorage();
  }
  return cached;
}

/** For tests / config reloads */
export function resetMediaStorageCache(): void {
  cached = null;
}

export function getMediaDriver(): "local" | "s3" {
  return getEnv().MEDIA_DRIVER;
}
