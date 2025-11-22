"use client";

import { useState, useEffect } from "react";
import { postsApi } from "@/lib/api";

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
}

interface UsePostsOptions {
  author?: string;
  limit?: number;
  autoLoad?: boolean;
}

export function usePosts(options: UsePostsOptions = {}) {
  const { author, limit = 20, autoLoad = true } = options;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(autoLoad);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (autoLoad) {
      loadPosts();
    }
  }, [author]);

  const loadPosts = async (reset = false) => {
    try {
      setLoading(true);
      setError(null);

      const result = await postsApi.list({
        limit,
        cursor: reset ? undefined : cursor,
        author,
      });

      if (reset) {
        setPosts(result.items);
      } else {
        setPosts((prev) => [...prev, ...result.items]);
      }

      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadPosts();
    }
  };

  return {
    posts,
    loading,
    hasMore,
    error,
    loadMore,
    refetch: () => loadPosts(true),
  };
}

