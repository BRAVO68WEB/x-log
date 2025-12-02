import type { Metadata } from "next";
import { headers } from "next/headers";
import PostClient from "./Client";

export default function PostPage(props: { params: Promise<{ id: string }> }) {
  return <PostClient {...props} />;
}

export async function generateMetadata(
  { params }: { params: { id: string } }
): Promise<Metadata> {
  try {
    const { id } = await params;
    const hdrs = await headers();
    const host = hdrs.get("host") || "localhost:4000";
    const proto = hdrs.get("x-forwarded-proto") || "http";
    const base = `${proto}://${host}`;
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
    };
    return {
      title: `${post.title} — x-log`,
      description: post.summary || undefined,
      openGraph: {
        title: post.title,
        description: post.summary || undefined,
        type: "article",
        images: post.banner_url ? [post.banner_url] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description: post.summary || undefined,
        images: post.banner_url ? [post.banner_url] : undefined,
      },
    };
  } catch {
    return { title: "Post — x-log" };
  }
}
