"use client";

import { useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { TableOfContents } from "@/components/TableOfContents";
import { MermaidRenderer } from "@/components/MermaidRenderer";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "react-query";
import { useAuth } from "@/hooks/useAuth";

interface Post {
  id: string;
  title: string;
  content_html: string;
  banner_url?: string | null;
  published_at: string | null;
  hashtags: string[];
  like_count: number;
  author_id: string;
  author: {
    username: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
}

export default function PostClient(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const { user } = useAuth();
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
        <Card className="max-w-4xl mx-auto">
          <CardContent className="p-8 text-center">
            <h1 className="text-2xl font-bold font-heading mb-2">
              Post not found
            </h1>
            <p className="text-muted-foreground">
              The post you&apos;re looking for doesn&apos;t exist.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto flex gap-8">
        <Card className="flex-1 min-w-0">
          <CardContent className="p-8">
            <h1 className="text-4xl font-bold mb-4 font-heading">{post.title}</h1>
            <div className="flex items-center gap-3 text-muted-foreground mb-4 pb-4">
              <span>By</span>
              <Link
                href={`/u/${post.author.username}`}
                className="hover:text-primary transition-colors font-medium flex items-center gap-2"
              >
                <Avatar className="h-8 w-8">
                  {post.author.avatar_url ? (
                    <AvatarImage
                      src={post.author.avatar_url}
                      alt={
                        post.author.full_name?.split(" ")[0] ||
                        post.author.username
                      }
                    />
                  ) : (
                    <AvatarFallback>
                      {(post.author.full_name || post.author.username)[0]?.toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span>
                  {post.author.full_name?.split(" ")[0] || post.author.username}
                </span>
              </Link>
              <span>·</span>
              <span>
                {post.published_at
                  ? new Date(post.published_at).toLocaleDateString()
                  : "Draft"}
              </span>
              <div className="ml-auto flex items-center gap-3">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <span>{post.like_count}</span>
                </div>
                {user && (user.id === post.author_id || user.role === "admin") && (
                  <Link href={`/editor/${post.id}`}>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <Separator className="mb-6" />
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
            {/* Mobile ToC: shown inline above content */}
            <div className="lg:hidden mb-6">
              <TableOfContents contentHtml={post.content_html} />
            </div>
            <MermaidRenderer
              contentHtml={post.content_html}
              className="prose prose-lg max-w-none"
            />
            {post.hashtags && post.hashtags.length > 0 && (
              <>
                <Separator className="my-8" />
                <div className="flex flex-wrap gap-2">
                  {post.hashtags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/search?hashtag=${encodeURIComponent(tag)}&type=post`}
                    >
                      <Badge variant="secondary" className="cursor-pointer">
                        #{tag}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        {/* Desktop ToC sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24">
            <TableOfContents contentHtml={post.content_html} />
          </div>
        </aside>
      </div>
    </main>
  );
}
