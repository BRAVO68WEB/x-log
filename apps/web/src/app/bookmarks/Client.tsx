"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useInfiniteQuery } from "react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { bookmarksApi, type BookmarkItem } from "@/lib/api";
import { Bookmark, Plus, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "react-query";

export default function BookmarksListClient() {
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery(
    ["bookmarks"],
    ({ pageParam }) => bookmarksApi.list({ limit: 20, cursor: pageParam }),
    {
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.nextCursor : undefined,
    }
  );

  const deleteMutation = useMutation(
    (id: string) => bookmarksApi.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(["bookmarks"]);
      },
    }
  );

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">
              Bookmarks
            </h1>
            <p className="text-muted-foreground mt-2">
              {items.length} saved {items.length === 1 ? "post" : "posts"}
            </p>
          </div>
          <Link href="/bookmarks/new">
            <Button>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Bookmark className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-medium mb-2">No bookmarks yet</h2>
            <p className="text-muted-foreground mb-6">
              Save posts you want to read later.
            </p>
            <Link href="/bookmarks/new">
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Add Bookmark
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <BookmarkCard
                key={item.id}
                item={item}
                onDelete={() => {
                  if (confirm("Remove this bookmark?")) {
                    deleteMutation.mutate(item.id);
                  }
                }}
              />
            ))}

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

function BookmarkCard({
  item,
  onDelete,
}: {
  item: BookmarkItem;
  onDelete: () => void;
}) {
  const href = item.post_id ? `/post/${item.post_id}` : item.url || "#";

  return (
    <Card className="overflow-hidden transition-colors hover:border-input">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {item.banner_url && (
            <Link href={href} className="shrink-0">
              <div className="relative w-20 h-20 rounded-md overflow-hidden">
                <Image
                  src={item.banner_url}
                  alt={item.title}
                  fill
                  sizes="80px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            </Link>
          )}
          <div className="flex-1 min-w-0">
            <Link href={href}>
              <h3 className="font-medium hover:text-primary transition-colors truncate">
                {item.title}
              </h3>
            </Link>
            {item.summary && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {item.summary}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              {item.author && (
                <>
                  <span>{item.author.full_name || item.author.username}</span>
                  <span>·</span>
                </>
              )}
              {item.published_at && (
                <>
                  <time dateTime={item.published_at}>
                    {new Date(item.published_at).toLocaleDateString()}
                  </time>
                  <span>·</span>
                </>
              )}
              <span>Saved {new Date(item.created_at).toLocaleDateString()}</span>
            </div>
            {item.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.hashtags.slice(0, 5).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    #{tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
