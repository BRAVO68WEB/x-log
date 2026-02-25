"use client";

import { useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { useQuery } from "react-query";

interface Post {
  id: string;
  title: string;
  content_html: string;
  banner_url?: string | null;
  published_at: string | null;
  hashtags: string[];
  like_count: number;
  author: {
    username: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

export default function PostClient(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useQuery<Post>(
    ["post", params.id],
    async () => {
      const res = await fetch(`/api/posts/${params.id}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: "Failed to load post" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<Post>;
    },
    {
      onSuccess: (data) => setPost(data),
      onSettled: () => setLoading(false),
    }
  );

  if (loading || query.isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto bg-light-surface dark:bg-dark-surface opacity-100 rounded-lg shadow-md p-8 text-center border border-light-highlight-med dark:border-dark-highlight-med">
          <h1 className="text-2xl font-bold text-light-text dark:text-dark-text mb-2">Post not found</h1>
          <p className="text-light-muted dark:text-dark-muted">The post you&apos;re looking for doesn&apos;t exist.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <article className="max-w-4xl mx-auto bg-light-surface dark:bg-dark-surface opacity-100 rounded-lg shadow-md p-8 border border-light-highlight-med dark:border-dark-highlight-med">
        <h1 className="text-4xl font-bold mb-4 text-light-text dark:text-dark-text">{post.title}</h1>
        <div className="text-light-muted dark:text-dark-muted mb-4 pb-4 border-b border-light-highlight-med dark:border-dark-highlight-med flex items-center">
          <div className="mr-2">
            By{" "}
          </div>
          <Link
            href={`/u/${post.author.username}`}
            className="hover:text-light-pine dark:hover:text-dark-foam transition-colors font-medium"
          >
            <div className="flex items-center space-x-2">
              {post.author.avatar_url && (
                <Image
                  src={post.author.avatar_url}
                  alt={post.author.full_name?.split(" ")[0] || post.author.username}
                  width={32}
                  height={32}
                  className="rounded-full mr-2"
                  unoptimized
                />
              )}
              {post.author.full_name?.split(" ")[0] || post.author.username}
            </div>
          </Link>
          <div className="mr-2">
            •{" "}
          </div>
          <div className="text-light-muted dark:text-dark-muted">
            {post.published_at ? new Date(post.published_at).toLocaleDateString() : "Draft"}
          </div>
          <div className="ml-4 flex items-center gap-1 text-light-muted dark:text-dark-muted">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span>{post.like_count}</span>
          </div>
        </div>
        {post.banner_url && (
          <div className="relative w-full h-64 mb-8 overflow-hidden rounded-lg">
            <Image
              src={post.banner_url}
              alt={post.title}
              className="object-cover"
              unoptimized
              fill
            />
          </div>
        )}
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />
        {post.hashtags && post.hashtags.length > 0 && (
          <>
            <hr className="my-8 border-light-highlight-med dark:border-dark-highlight-med" />
            <div className="flex flex-wrap gap-2">
              {post.hashtags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?hashtag=${encodeURIComponent(tag)}&type=post`}
                  className="px-3 py-1 rounded-full text-sm bg-light-pine/10 dark:bg-dark-pine/20 text-light-pine dark:text-dark-foam hover:bg-light-pine/20 dark:hover:bg-dark-pine/30 transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          </>
        )}
      </article>
    </main>
  );
}
