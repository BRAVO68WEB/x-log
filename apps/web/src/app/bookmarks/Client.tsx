"use client";

import { useState } from "react";
import { useQuery } from "react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BentoGrid, BentoCard, BentoCardContent } from "@/components/ui/bento-grid";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Search, BookmarkIcon, Plus, ExternalLink } from "lucide-react";

interface Bookmark {
  id: string;
  postId: string;
  title: string | null;
  contentMarkdown: string | null;
  bannerUrl: string | null;
  publishedAt: string | null;
  created_at: string;
  favicon?: string;
  og_image?: string;
  tags: string[];
  read_later: boolean;
}

function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  return (
    <div className="group">
      <a
        href={`/post/${bookmark.postId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4 rounded-lg border hover:bg-accent transition-colors"
      >
        <div className="flex items-start gap-3">
          {bookmark.favicon && (
            <img
              src={bookmark.favicon}
              alt=""
              className="w-5 h-5 mt-0.5 rounded"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{bookmark.title || "Untitled"}</h3>
            {bookmark.contentMarkdown && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {bookmark.contentMarkdown.slice(0, 200)}
              </p>
            )}
          </div>
          <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        </div>
      </a>
      <div className="flex items-center gap-3 mt-2 px-1">
        {bookmark.read_later && (
          <Badge variant="secondary" className="text-xs py-0">
            Read later
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(bookmark.created_at).toLocaleDateString()}
        </span>
        {(Array.isArray(bookmark.tags) ? bookmark.tags : []).map((tag) => (
          <Badge key={tag} variant="outline" className="text-xs py-0">
            {tag}
          </Badge>
        ))}
        {Array.isArray(bookmark.tags) && bookmark.tags.length > 3 && (
          <span className="text-xs text-muted-foreground">+{bookmark.tags.length - 3}</span>
        )}
      </div>
    </div>
  );
}

export default function BookmarksClient() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "read-later">("all");

  const query = useQuery<Bookmark[]>(
    ["bookmarks"],
    async () => {
      const res = await fetch("/api/content/bookmarks", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load bookmarks");
      const data = await res.json();
      return data.items ?? data;
    },
    {
      onSuccess: (data) => setBookmarks(data),
      onSettled: () => setLoading(false),
    }
  );

  let filteredBookmarks = bookmarks.filter(
    (b) =>
      (b.title?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (Array.isArray(b.tags)
        ? b.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
        : false)
  );

  if (filter === "read-later") {
    filteredBookmarks = filteredBookmarks.filter((b) => b.read_later);
  }

  if (loading && query.isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Bookmarks</h1>
            <p className="text-muted-foreground mt-2">
              {filteredBookmarks.length} of {bookmarks.length} bookmarks
            </p>
          </div>
          <a href="/bookmarks/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Bookmark
            </Button>
          </a>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bookmarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "read-later" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("read-later")}
            >
              Read Later
            </Button>
          </div>
        </div>

        <BentoGrid columns={2}>
          {filteredBookmarks.length === 0 ? (
            <BentoCard size="full" index={0}>
              <BentoCardContent className="p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                  <BookmarkIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-normal tracking-[-0.02em] font-heading mb-2">
                  {search || filter !== "all" ? "No matching bookmarks" : "No bookmarks yet"}
                </h2>
                <p className="text-muted-foreground mb-4">
                  {search || filter !== "all"
                    ? "Try a different filter"
                    : "Save links to read later"}
                </p>
                {!search && filter === "all" && (
                  <a href="/bookmarks/new">
                    <Button variant="outline">Add your first bookmark</Button>
                  </a>
                )}
              </BentoCardContent>
            </BentoCard>
          ) : (
            filteredBookmarks.map((bookmark, index) => (
              <BentoCard key={bookmark.id} size="full" index={index}>
                <BookmarkCard bookmark={bookmark} />
              </BentoCard>
            ))
          )}
        </BentoGrid>
      </div>
    </main>
  );
}
