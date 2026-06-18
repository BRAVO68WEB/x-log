"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { threadsApi, type ThreadItem, type ThreadPost } from "@/lib/api";
import { ArrowLeft, Heart, Plus, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function ThreadViewClient(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const { user } = useAuth();

  const { data, isLoading } = useQuery(
    ["thread", params.id],
    () => threadsApi.get(params.id)
  );

  if (isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-2xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-heading">Thread not found</h1>
          <Button variant="ghost" className="mt-4" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go home
          </Button>
        </div>
      </main>
    );
  }

  const { thread, posts } = data;
  const isOwner = user?.id === thread.user.id;

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            {thread.title && (
              <h1 className="text-2xl font-normal tracking-[-0.02em] font-heading">
                {thread.title}
              </h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Link
                href={`/u/${thread.user.username}`}
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <Avatar className="h-6 w-6">
                  {thread.user.avatar_url ? (
                    <AvatarImage src={thread.user.avatar_url} alt={thread.user.username} />
                  ) : (
                    <AvatarFallback className="text-xs">
                      {(thread.user.full_name || thread.user.username)[0]?.toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <span className="text-sm font-medium">
                  {thread.user.full_name || thread.user.username}
                </span>
              </Link>
              <span className="text-sm text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">
                {posts.length} posts
              </span>
              <span className="text-sm text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(thread.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Thread posts with vertical rail */}
        <div className="space-y-0">
          {posts.map((post, index) => (
            <div key={post.id} className="flex gap-4">
              {/* Vertical rail */}
              <div className="flex flex-col items-center shrink-0">
                <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-mono font-medium">
                  {post.position}
                </div>
                {index < posts.length - 1 && (
                  <div className="w-0.5 flex-1 bg-border min-h-[20px]" />
                )}
              </div>

              {/* Post content */}
              <div className="flex-1 pb-6 min-w-0">
                <div className="rounded-lg border bg-card p-5">
                  {post.title && (
                    <h2 className="text-lg font-medium mb-2 font-heading">{post.title}</h2>
                  )}

                  <div className="prose prose-sm max-w-none">
                    {post.content_markdown.split("\n").map((line, i) => (
                      <p key={i} className="mb-2 last:mb-0">{line || <br />}</p>
                    ))}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Link
                        href={`/post/${post.id}`}
                        className="hover:text-primary transition-colors"
                      >
                        View post
                      </Link>
                      {post.published_at && (
                        <>
                          <span>·</span>
                          <span>{new Date(post.published_at).toLocaleTimeString()}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Heart className="h-3.5 w-3.5" />
                      <span>{post.like_count}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add to thread (owner only) */}
        {isOwner && (
          <div className="mt-6 pt-6 border-t">
            <Link href={`/editor?thread=${params.id}`}>
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                Add to Thread
              </Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
