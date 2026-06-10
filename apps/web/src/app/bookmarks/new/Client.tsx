"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { bookmarksApi, type BookmarkItem } from "@/lib/api";
import { Search, Bookmark } from "lucide-react";

interface Post {
  id: string;
  title: string;
  content_markdown: string;
  banner_url: string | null;
  published_at: string | null;
}

export default function NewBookmarkClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: posts, isLoading } = useQuery<{ items: Post[] }>(
    ["posts-search"],
    async () => {
      const res = await fetch(`/api/posts?limit=20&q=${encodeURIComponent(search)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load posts");
      return res.json();
    },
    { enabled: search.length > 0 }
  );

  const createMutation = useMutation(
    async (postId: string) => {
      await bookmarksApi.create({ postId });
    },
    {
      onSuccess: () => {
        router.push("/bookmarks");
      },
      onError: (err) => {
        setError(err instanceof Error ? err.message : "Failed to add bookmark");
      },
    }
  );

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Add Bookmark</h1>
            <p className="text-muted-foreground mt-2">Search for a post to bookmark</p>
          </div>
          <Button variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts by title..."
              className="pl-10"
              autoFocus
            />
          </div>

          {isLoading && (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          )}

          {search.length > 0 && !isLoading && posts?.items && (
            <div className="space-y-2">
              {posts.items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No posts found</p>
              ) : (
                posts.items.map((post) => (
                  <div
                    key={post.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedPost?.id === post.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent"
                    }`}
                    onClick={() => setSelectedPost(post)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{post.title}</h3>
                        {post.published_at && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(post.published_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPost(post);
                        }}
                      >
                        <Bookmark className="h-4 w-4 mr-1" />
                        Bookmark
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {selectedPost && (
            <div className="border-t pt-6 mt-6">
              <h2 className="text-lg font-medium mb-4">Selected Post</h2>
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="font-medium">{selectedPost.title}</h3>
                {selectedPost.published_at && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {new Date(selectedPost.published_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-4 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedPost(null);
                    setSearch("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => createMutation.mutate(selectedPost.id)}
                  disabled={createMutation.isLoading}
                >
                  {createMutation.isLoading ? "Adding..." : "Add Bookmark"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
