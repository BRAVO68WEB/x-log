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
    const domain = getDomainFromOrigin(base);
    const authorName = post.author.full_name || post.author.username;
    const authorPath = `/u/${post.author.username}`;
    const actorUrl = getActorUrl(post.author.username, domain);
    const handle = getFediverseHandle(post.author.username, domain);
    const canonical = post.url || `/post/${post.id}`;
    const image = absoluteUrl(post.banner_url, base);

    return {
      metadataBase: new URL(base),
      title: `${post.title} — x-log`,
      description: post.summary || undefined,
      authors: [{ name: authorName, url: authorPath }],
      creator: authorName,
      alternates: {
        canonical,
      },
      openGraph: {
        title: post.title,
        description: post.summary || undefined,
        url: canonical,
        type: "article",
        publishedTime: post.published_at || undefined,
        modifiedTime: post.updated_at || undefined,
        authors: [authorPath],
        tags: post.hashtags,
        images: image ? [image] : undefined,
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title: post.title,
        description: post.summary || undefined,
        images: image ? [image] : undefined,
      },
      other: {
        author: authorName,
        "article:author": actorUrl,
        "fediverse:creator": handle,
        "activitypub:actor": actorUrl,
      },
    };
  } catch {
    return { title: "Post — x-log" };
  }
}
