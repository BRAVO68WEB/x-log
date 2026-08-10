"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { threadsApi } from "@/lib/api";
import { Plus, Trash2, GripVertical, ArrowLeft } from "lucide-react";

interface ThreadPostDraft {
  id: string;
  content_markdown: string;
  title: string;
}

export default function NewThreadClient() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [posts, setPosts] = useState<ThreadPostDraft[]>([
    { id: crypto.randomUUID(), content_markdown: "", title: "" },
    { id: crypto.randomUUID(), content_markdown: "", title: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation(
    async () => {
      return threadsApi.create({
        title: title || undefined,
        posts: posts
          .filter((p) => p.content_markdown.trim())
          .map((p) => ({
            content_markdown: p.content_markdown,
            title: p.title || undefined,
          })),
      });
    },
    {
      onSuccess: (data) => router.push(`/threads/${data.id}`),
      onError: (err) => setError(err instanceof Error ? err.message : "Failed to create thread"),
    }
  );

  const addPost = () => {
    setPosts([...posts, { id: crypto.randomUUID(), content_markdown: "", title: "" }]);
  };

  const removePost = (id: string) => {
    if (posts.length <= 2) return;
    setPosts(posts.filter((p) => p.id !== id));
  };

  const updatePost = (id: string, field: "content_markdown" | "title", value: string) => {
    setPosts(posts.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const movePost = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= posts.length) return;
    const newPosts = [...posts];
    [newPosts[index], newPosts[newIndex]] = [newPosts[newIndex], newPosts[index]];
    setPosts(newPosts);
  };

  const validPosts = posts.filter((p) => p.content_markdown.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (validPosts.length < 2) {
      setError("A thread needs at least 2 posts");
      return;
    }
    createMutation.mutate();
  };

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">New Thread</h1>
            <p className="text-muted-foreground mt-1">
              Create a thread of connected posts ({posts.length} posts)
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-md bg-destructive/10 p-4 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="thread-title">Thread Title (optional)</Label>
            <Input
              id="thread-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your thread a title..."
            />
          </div>

          <div className="space-y-4">
            {posts.map((post, index) => (
              <div key={post.id} className="relative flex gap-3">
                {/* Vertical rail connector */}
                <div className="flex flex-col items-center gap-1 pt-2">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-mono text-muted-foreground bg-muted rounded-full w-6 h-6 flex items-center justify-center">
                      {index + 1}
                    </span>
                    {index < posts.length - 1 && (
                      <div className="w-px h-full bg-border mt-1" />
                    )}
                  </div>
                </div>

                {/* Post content */}
                <div className="flex-1 rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => movePost(index, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => movePost(index, 1)}
                        disabled={index === posts.length - 1}
                      >
                        ↓
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removePost(post.id)}
                      disabled={posts.length <= 2}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <Input
                    value={post.title}
                    onChange={(e) => updatePost(post.id, "title", e.target.value)}
                    placeholder="Post title (optional)"
                    className="text-sm"
                  />

                  <textarea
                    value={post.content_markdown}
                    onChange={(e) => updatePost(post.id, "content_markdown", e.target.value)}
                    placeholder={`What's on your mind? (post ${index + 1})`}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-y min-h-[80px]"
                    required
                  />

                  <div className="text-xs text-muted-foreground text-right">
                    {post.content_markdown.length} / 10000
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addPost} className="w-full">
            <Plus className="h-4 w-4 mr-1" />
            Add Post
          </Button>

          <div className="flex justify-between items-center pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {validPosts.length} of {posts.length} posts have content
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isLoading || validPosts.length < 2}
              >
                {createMutation.isLoading ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" />
                    Creating...
                  </span>
                ) : (
                  "Publish Thread"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
