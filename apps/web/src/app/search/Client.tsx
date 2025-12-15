"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { PostCard } from "@/components/PostCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "react-query";

interface SearchPost {
  id: string;
  title: string;
  summary?: string | null;
  banner_url?: string | null;
  hashtags: string[];
  like_count: number;
  author: {
    username: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
  published_at: string | null;
}

interface SearchProfile {
  username: string;
  full_name?: string | null;
  bio?: string | null;
}

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const hashtag = searchParams.get("hashtag") || "";
  const type = (searchParams.get("type") || "post") as "post" | "profile";

  const isHashtagMode = Boolean(hashtag) && type === "post";

  const infinite = useInfiniteQuery<{ items: SearchPost[]; nextCursor?: string; hasMore: boolean }>(
    ["search-hashtag", hashtag],
    async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set("hashtag", hashtag);
      params.set("type", "post");
      params.set("limit", String(9));
      if (pageParam) params.set("cursor", String(pageParam));
      const res = await fetch(`/api/search?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Search failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ items: SearchPost[]; nextCursor?: string; hasMore: boolean }>;
    },
    {
      enabled: isHashtagMode,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const { data, isLoading } = useQuery<{ items: (SearchPost | SearchProfile)[] }>(
    ["search", query, type],
    async () => {
      const params = new URLSearchParams({ q: query });
      params.set("type", type);
      const res = await fetch(`/api/search?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Search failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ items: (SearchPost | SearchProfile)[] }>;
    },
    { enabled: Boolean(query) && !isHashtagMode }
  );

  const results = useMemo(
    () =>
      isHashtagMode
        ? (infinite.data?.pages ?? []).flatMap((p) => p.items)
        : data?.items ?? [],
    [isHashtagMode, infinite.data, data]
  );
  const hasMore = isHashtagMode ? Boolean(infinite.data?.pages.at(-1)?.hasMore) : false;
  const loading = isHashtagMode ? infinite.isLoading : isLoading;

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : results.length > 0 ? (
        <>
          {type === "post" ? (
            <>
              <div className="space-y-6">
                {results.map((post) => (
                  <PostCard key={(post as SearchPost).id} {...(post as SearchPost)} />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center py-6">
                  <button
                    onClick={() => infinite.fetchNextPage()}
                    disabled={infinite.isFetching}
                    className="px-4 py-2 rounded-md bg-light-overlay dark:bg-dark-overlay opacity-100 border border-light-highlight-med dark:border-dark-highlight-med text-light-text dark:text-dark-text"
                  >
                    {infinite.isFetching ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              {results.map((profile) => (
                <Link
                  key={(profile as SearchProfile).username}
                  href={`/u/${(profile as SearchProfile).username}`}
                  className="block bg-light-surface dark:bg-dark-surface opacity-100 rounded-lg shadow-md p-6 border border-light-highlight-med dark:border-dark-highlight-med hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
                    {(profile as SearchProfile).full_name?.split(" ")[0] ||
                      (profile as SearchProfile).username}
                  </h3>
                  <p className="text-light-muted dark:text-dark-muted">
                    @{(profile as SearchProfile).username}
                  </p>
                  {(profile as SearchProfile).bio && (
                    <p className="mt-2 text-light-text dark:text-dark-text">
                      {(profile as SearchProfile).bio}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </>
      ) : hashtag || query ? (
        <p className="text-center text-light-muted dark:text-dark-muted py-12">No results found.</p>
      ) : (
        <p className="text-center text-light-muted dark:text-dark-muted py-12">Enter a search query to get started.</p>
      )}
    </div>
  );
}

export default function SearchClient() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-light-text dark:text-dark-text">Search</h1>
        <div className="mb-8">
          <SearchBar />
        </div>
        <SearchResults />
      </div>
    </main>
  );
}
