"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { postsApi } from "@/lib/api";

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [postId, setPostId] = useState<string>("");

  useEffect(() => {
    params.then(async (p) => {
      setPostId(p.id);
      try {
        const data = await postsApi.get(p.id);
        setPost(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  if (loading) {
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
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Post not found</h1>
          <p className="text-gray-600">The post you're looking for doesn't exist.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <article className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8 border border-gray-200">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">{post.title}</h1>
        <div className="text-gray-600 mb-8 pb-4 border-b">
          By{" "}
          <Link
            href={`/u/${post.author.username}`}
            className="hover:text-blue-600 transition-colors font-medium"
          >
            {post.author.full_name || post.author.username}
          </Link>{" "}
          • {post.published_at ? new Date(post.published_at).toLocaleDateString() : "Draft"}
        </div>
        {post.banner_url && (
          <img src={post.banner_url} alt={post.title} className="w-full mb-8 rounded-lg" />
        )}
        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content_html }}
        />
      </article>
    </main>
  );
}
