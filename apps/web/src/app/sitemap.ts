import type { MetadataRoute } from "next";
import { headers } from "next/headers";

interface PostItem {
  id: string;
  author: { username: string };
  published_at: string | null;
}

interface PostsResponse {
  items: PostItem[];
  nextCursor?: string;
  hasMore: boolean;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const hdrs = await headers();
  const host = hdrs.get("host") || "localhost:4000";
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const base = `${proto}://${host}`;

  // Paginate through all posts
  const posts: PostItem[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${base}/api/posts?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) break;

    const data: PostsResponse = await res.json();
    posts.push(...data.items);
    cursor = data.hasMore ? data.nextCursor : undefined;
  } while (cursor);

  // Deduplicate authors
  const usernames = [...new Set(posts.map((p) => p.author.username))];

  return [
    // Static routes
    { url: `${base}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/search`, changeFrequency: "weekly", priority: 0.3 },

    // Post pages
    ...posts.map((post) => ({
      url: `${base}/post/${post.id}`,
      lastModified: post.published_at ? new Date(post.published_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),

    // User profiles
    ...usernames.map((username) => ({
      url: `${base}/u/${username}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
