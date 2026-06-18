import type { Metadata } from "next";
import { headers } from "next/headers";
import PostClient from "./Client";
import {
  absoluteUrl,
  getActorUrl,
  getDomainFromOrigin,
  getFediverseHandle,
  getOriginFromHeaders,
} from "@/lib/seo";

export default function PostPage(props: { params: Promise<{ id: string }> }) {
  return <PostClient {...props} />;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const { id } = await params;
    const hdrs = await headers();
    const base = getOriginFromHeaders(hdrs);
    const res = await fetch(`${base}/api/posts/${id}`, { cache: "no-store" });
    if (!res.ok) {
      console.error(`Failed to fetch post ${id}: ${res.statusText}`);
      return { title: "Post not found — x-log" };
    }
    const post = (await res.json()) as {
      id: string;
      title: string;
      summary?: string | null;
      banner_url?: string | null;
      author: { username: string; full_name?: string | null };
      published_at: string | null;
      updated_at?: string | null;
      hashtags?: string[];
      url?: string;
    };

    // Fetch custom metadata (best-effort, gated by feature flag)
    let customMeta: Record<string, string> = {};
    try {
      const metaRes = await fetch(`${base}/api/posts/${id}/meta`, {
        cache: "no-store",
      });
      if (metaRes.ok) {
        const metaData = (await metaRes.json()) as { meta?: Record<string, string> };
        customMeta = metaData.meta || {};
      }
    } catch {
      // Feature may be disabled — ignore
    }

    const domain = getDomainFromOrigin(base);
    const authorName = post.author.full_name || post.author.username;
    const authorPath = `/u/${post.author.username}`;
    const actorUrl = getActorUrl(post.author.username, domain);
    const handle = getFediverseHandle(post.author.username, domain);
    const canonical = customMeta["canonical"] || post.url || `/post/${post.id}`;
    const image = absoluteUrl(customMeta["og:image"] || post.banner_url, base);
    const description = customMeta["og:description"] || post.summary || undefined;
    const robots = customMeta["robots"] || undefined;

    return {
      metadataBase: new URL(base),
      title: `${post.title} — x-log`,
      description,
      authors: [{ name: authorName, url: authorPath }],
      creator: authorName,
      robots: robots ? { index: !robots.includes("noindex"), follow: !robots.includes("nofollow") } : undefined,
      alternates: {
        canonical,
      },
      openGraph: {
        title: post.title,
        description,
        url: canonical,
        type: "article",
        publishedTime: post.published_at || undefined,
        modifiedTime: post.updated_at || undefined,
        authors: [authorPath],
        tags: post.hashtags,
        images: image ? [image] : undefined,
      },
      twitter: {
        card: (customMeta["twitter:card"] as any) || (image ? "summary_large_image" : "summary"),
        title: post.title,
        description,
        images: image ? [image] : undefined,
      },
      other: {
        author: authorName,
        "article:author": actorUrl,
        "fediverse:creator": handle,
        "activitypub:actor": actorUrl,
        ...Object.fromEntries(
          Object.entries(customMeta).filter(([k]) =>
            k.startsWith("og:") || k.startsWith("twitter:") || k.startsWith("custom:")
          )
        ),
      },
    };
  } catch {
    return { title: "Post — x-log" };
  }
}
