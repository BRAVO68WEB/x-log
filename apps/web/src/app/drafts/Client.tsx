"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient } from "react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { postsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus,
  FileText,
  Eye,
  EyeOff,
  Trash2,
  Edit,
  Clock,
  Send,
} from "lucide-react";

type FilterTab = "all" | "drafts" | "published";

export default function DraftsClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery(
    ["my-posts"],
    ({ pageParam }) =>
      postsApi.list({ limit: 20, cursor: pageParam, mine: true }),
    {
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.nextCursor : undefined,
      enabled: !!user,
    }
  );

  const deleteMutation = useMutation(
    (id: string) =>
      fetch(`/api/posts/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to delete");
      }),
    {
      onSuccess: () => queryClient.invalidateQueries(["my-posts"]),
    }
  );

  const publishMutation = useMutation(
    (id: string) =>
      fetch(`/api/posts/${id}/publish`, {
        method: "POST",
        credentials: "include",
      }).then((r) => {
        if (!r.ok) throw new Error("Failed to publish");
      }),
    {
      onSuccess: () => queryClient.invalidateQueries(["my-posts"]),
    }
  );

  const allPosts = data?.pages.flatMap((page) => page.items) ?? [];
  const filteredPosts = allPosts.filter((post) => {
    if (activeTab === "drafts") return !post.published_at;
    if (activeTab === "published") return !!post.published_at;
    return true;
  });

  const draftCount = allPosts.filter((p) => !p.published_at).length;
  const publishedCount = allPosts.filter((p) => !!p.published_at).length;

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">
              My Posts
            </h1>
            <p className="text-muted-foreground mt-1">
              {draftCount} drafts · {publishedCount} published
            </p>
          </div>
          <Link href="/editor">
            <Button>
              <Plus className="h-4 w-4 mr-1" /> New Post
            </Button>
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(["all", "drafts", "published"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === "drafts" && draftCount > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({draftCount})</span>
              )}
              {tab === "published" && publishedCount > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({publishedCount})</span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-medium mb-2">
              {activeTab === "drafts"
                ? "No drafts"
                : activeTab === "published"
                ? "No published posts"
                : "No posts yet"}
            </h2>
            <p className="text-muted-foreground mb-6">
              {activeTab === "drafts"
                ? "Start writing and save as draft."
                : "Create your first post."}
            </p>
            <Link href="/editor">
              <Button>
                <Plus className="h-4 w-4 mr-1" /> New Post
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPosts.map((post) => {
              const isDraft = !post.published_at;
              return (
                <Card
                  key={post.id}
                  className="overflow-hidden transition-colors hover:border-input"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isDraft ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <EyeOff className="h-3 w-3" /> Draft
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Eye className="h-3 w-3" /> {post.visibility}
                            </Badge>
                          )}
                          <h3 className="font-medium truncate">{post.title || "Untitled"}</h3>
                        </div>

                        {post.content_markdown && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {post.content_markdown.substring(0, 150)}
                          </p>
                        )}

                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {isDraft
                              ? `Saved ${new Date(post.updated_at).toLocaleDateString()}`
                              : `Published ${new Date(post.published_at!).toLocaleDateString()}`}
                          </span>
                          {post.hashtags.length > 0 && (
                            <span className="flex gap-1">
                              {post.hashtags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  #{tag}
                                </Badge>
                              ))}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => router.push(`/editor/${post.id}`)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {isDraft && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-primary"
                            onClick={() => publishMutation.mutate(post.id)}
                            disabled={publishMutation.isLoading}
                            title="Publish now"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {!isDraft && (
                          <Link href={`/post/${post.id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive"
                          onClick={() => {
                            if (confirm("Delete this post? This cannot be undone."))
                              deleteMutation.mutate(post.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
