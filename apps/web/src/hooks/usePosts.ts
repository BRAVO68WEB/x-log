"use client";

import { useEffect } from "react";
import { useInfiniteQuery } from "react-query";

interface Post {
  id: string;
  title: string;
  summary?: string | null;
  author: {
    username: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
  published_at: string | null;
  banner_url?: string | null;
  hashtags: string[];
  like_count: number;
  liked_by_me?: boolean;
}

interface UsePostsOptions {
  author?: string;
  limit?: number;
  autoLoad?: boolean;
}

export function usePosts(options: UsePostsOptions = {}) {
  const { author, limit = 20, autoLoad = true } = options;

  const query = useInfiniteQuery<{ items: Post[]; nextCursor?: string; hasMore: boolean }>(
    ["posts", author, limit],
    async ({ pageParam }): Promise<{ items: Post[]; nextCursor?: string; hasMore: boolean }> => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (author) params.set("author", author);
      if (pageParam) params.set("cursor", String(pageParam));
      const res = await fetch(`/api/posts${params.toString() ? `?${params.toString()}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to load posts" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return (await res.json()) as { items: Post[]; nextCursor?: string; hasMore: boolean };
    },
    {
      enabled: autoLoad,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    }
  );

  const posts: Post[] = (query.data?.pages ?? [])
    .flatMap((p) => p.items)
    .filter((p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx);

  const hasMore = Boolean(query.hasNextPage);

  useEffect(() => {
    if (autoLoad) {
      query.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  return {
    posts,
    /** True only while the first page is loading */
    loading: query.isLoading,
    /** True while fetching any page after the first */
    loadingMore: query.isFetchingNextPage,
    /** True for any fetch (initial or more) — prefer loading / loadingMore in UI */
    fetching: query.isFetching,
    hasMore,
    error: query.error ? (query.error as Error).message : null,
    loadMore: () => {
      if (!query.isFetchingNextPage && query.hasNextPage) {
        void query.fetchNextPage();
      }
    },
    refetch: () => query.refetch(),
  };
}
