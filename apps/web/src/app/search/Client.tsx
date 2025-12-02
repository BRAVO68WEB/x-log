"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { PostCard } from "@/components/PostCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import Link from "next/link";
import { useQuery } from "react-query";

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
  const type = (searchParams.get("type") || "post") as "post" | "profile";

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
    { enabled: Boolean(query) }
  );

  const results = useMemo(() => data?.items ?? [], [data]);

  return (
    <div>
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-6">
          {type === "post" &&
            results.map((post) => (
              <PostCard key={(post as SearchPost).id} {...(post as SearchPost)} />
            ))}
          {type === "profile" && (
            <div className="space-y-4">
              {results.map((profile) => (
                <Link
                  key={(profile as SearchProfile).username}
                  href={`/u/${(profile as SearchProfile).username}`}
                  className="block bg-light-surface dark:bg-dark-surface opacity-100 rounded-lg shadow-md p-6 border border-light-highlight-med dark:border-dark-highlight-med hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-xl font-bold text-light-text dark:text-dark-text">
                    {(profile as SearchProfile).full_name ||
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
        </div>
      ) : query ? (
        <p className="text-center text-light-muted dark:text-dark-muted py-12">
          No results found.
        </p>
      ) : (
        <p className="text-center text-light-muted dark:text-dark-muted py-12">
          Enter a search query to get started.
        </p>
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
