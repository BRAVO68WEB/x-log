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
        <div className="text-light-muted dark:text-dark-muted mb-8 pb-4 border-b border-light-highlight-med dark:border-dark-highlight-med flex items-center">
          By{"  "}
          <Link
            href={`/u/${post.author.username}`}
            className="hover:text-light-pine dark:hover:text-dark-foam transition-colors font-medium"
          >
            <div className="flex items-center">
              {post.author.avatar_url && (
                <Image
                  src={post.author.avatar_url}
                  alt={post.author.full_name || post.author.username}
                  width={32}
                  height={32}
                  className="rounded-full mr-2"
                  unoptimized
                />
              )}
              {post.author.full_name || post.author.username}
            </div>
          </Link>{" "}
          • {post.published_at ? new Date(post.published_at).toLocaleDateString() : "Draft"}
        </div>
        {post.banner_url && (
          <div className="relative w-full h-64 mb-8">
            <Image
              src={post.banner_url}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
              className="object-cover rounded-lg"
              unoptimized
            />
          </div>
        )}
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />
      </article>
    </main>
  );
}
