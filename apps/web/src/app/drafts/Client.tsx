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

type FilterTab = "all" | "drafts" | "scheduled" | "published";

export default function DraftsClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

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

  const scheduleMutation = useMutation(
    ({ id, when }: { id: string; when: string }) => postsApi.schedule(id, when),
    {
      onSuccess: () => {
        setScheduleFor(null);
        setScheduleAt("");
        queryClient.invalidateQueries(["my-posts"]);
      },
    }
  );

  const unscheduleMutation = useMutation(
    (id: string) => postsApi.unschedule(id),
    {
      onSuccess: () => queryClient.invalidateQueries(["my-posts"]),
    }
  );

  const importMutation = useMutation(
    async () => {
      // Format: --- title: My Title
      // optional hashtags line, then body until next ---
      const blocks = importText.split(/\n---\n/).map((b) => b.trim()).filter(Boolean);
      const posts: Array<{
        title: string;
        content_markdown: string;
        hashtags?: string[];
        published?: boolean;
      }> = [];

      if (blocks.length === 0 && importText.trim()) {
        // single file: first line title, rest body
        const lines = importText.trim().split("\n");
        const title = lines[0]?.replace(/^#\s*/, "").trim() || "Imported post";
        posts.push({
          title: title.slice(0, 200),
          content_markdown: lines.slice(1).join("\n").trim() || lines[0] || " ",
        });
      } else {
        for (const block of blocks) {
          const lines = block.split("\n");
          let title = "Imported post";
          let hashtags: string[] = [];
          let bodyStart = 0;
          if (lines[0]?.toLowerCase().startsWith("title:")) {
            title = lines[0].slice(6).trim();
            bodyStart = 1;
            if (lines[1]?.toLowerCase().startsWith("tags:")) {
              hashtags = lines[1]
                .slice(5)
                .split(/[,\s]+/)
                .map((t) => t.replace(/^#/, ""))
                .filter(Boolean);
              bodyStart = 2;
            }
          } else if (lines[0]?.startsWith("# ")) {
            title = lines[0].slice(2).trim();
            bodyStart = 1;
          }
          const content_markdown = lines.slice(bodyStart).join("\n").trim() || title;
          posts.push({ title: title.slice(0, 200), content_markdown, hashtags });
        }
      }

      if (posts.length === 0) throw new Error("Nothing to import");
      return postsApi.importMarkdown(posts);
    },
    {
      onSuccess: (res) => {
        setImportOpen(false);
        setImportText("");
        setImportError(null);
        queryClient.invalidateQueries(["my-posts"]);
        alert(`Imported ${res.imported} draft(s)`);
      },
      onError: (err) => {
        setImportError(err instanceof Error ? err.message : "Import failed");
      },
    }
  );

  const allPosts = data?.pages.flatMap((page) => page.items) ?? [];
  const filteredPosts = allPosts.filter((post) => {
    if (activeTab === "drafts")
      return !post.published_at && !post.scheduled_at;
    if (activeTab === "scheduled")
      return !post.published_at && !!post.scheduled_at;
    if (activeTab === "published") return !!post.published_at;
    return true;
  });

  const draftCount = allPosts.filter((p) => !p.published_at && !p.scheduled_at).length;
  const scheduledCount = allPosts.filter((p) => !p.published_at && !!p.scheduled_at).length;
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
              {draftCount} drafts · {scheduledCount} scheduled · {publishedCount} published
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              Import MD
            </Button>
            <Link href="/editor">
              <Button>
                <Plus className="h-4 w-4 mr-1" /> New Post
              </Button>
            </Link>
          </div>
        </div>

        {importOpen && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="font-semibold font-heading">Import Markdown drafts</h2>
            <p className="text-xs text-muted-foreground">
              Paste one post (first line = title) or multiple blocks separated by a line with only{" "}
              <code>---</code>. Optional headers: <code>title: …</code> and <code>tags: a,b</code>.
            </p>
            <textarea
              className="w-full min-h-[160px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={"# My first post\n\nHello world.\n\n---\n\ntitle: Second post\ntags: notes\n\nBody here."}
            />
            {importError && (
              <p className="text-sm text-destructive">{importError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={importMutation.isLoading || !importText.trim()}
                onClick={() => {
                  setImportError(null);
                  importMutation.mutate();
                }}
              >
                {importMutation.isLoading ? "Importing…" : "Import as drafts"}
              </Button>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["all", "drafts", "scheduled", "published"] as FilterTab[]).map((tab) => (
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
              {tab === "scheduled" && scheduledCount > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({scheduledCount})</span>
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
              const isScheduled = isDraft && !!post.scheduled_at;
              return (
                <Card
                  key={post.id}
                  className="overflow-hidden transition-colors hover:border-input"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isScheduled ? (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Clock className="h-3 w-3" /> Scheduled
                            </Badge>
                          ) : isDraft ? (
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
                            {isScheduled
                              ? `Goes live ${new Date(post.scheduled_at!).toLocaleString()}`
                              : isDraft
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

                        {scheduleFor === post.id && (
                          <div className="mt-3 flex flex-wrap items-end gap-2">
                            <input
                              type="datetime-local"
                              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                              value={scheduleAt}
                              onChange={(e) => setScheduleAt(e.target.value)}
                            />
                            <Button
                              type="button"
                              size="sm"
                              disabled={!scheduleAt || scheduleMutation.isLoading}
                              onClick={() => {
                                const iso = new Date(scheduleAt).toISOString();
                                scheduleMutation.mutate({ id: post.id, when: iso });
                              }}
                            >
                              Confirm
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setScheduleFor(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
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
                          <>
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
                            {isScheduled ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => unscheduleMutation.mutate(post.id)}
                                disabled={unscheduleMutation.isLoading}
                                title="Clear schedule"
                              >
                                Unsched
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setScheduleFor(post.id);
                                  // default +1 day local
                                  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
                                  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                                  setScheduleAt(d.toISOString().slice(0, 16));
                                }}
                                title="Schedule"
                              >
                                <Clock className="h-4 w-4" />
                              </Button>
                            )}
                          </>
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
