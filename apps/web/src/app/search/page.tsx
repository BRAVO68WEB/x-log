"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { PostCard } from "@/components/PostCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import Link from "next/link";
import { searchApi } from "@/lib/api";

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const type = searchParams.get("type") || "post";
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query) {
      search();
    }
  }, [query, type]);

  const search = async () => {
    setLoading(true);
    try {
      const data = await searchApi.search(query, type as "post" | "profile" | undefined);
      setResults(data.items || []);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-6">
          {type === "post" &&
            results.map((post: any) => <PostCard key={post.id} {...post} />)}
          {type === "profile" && (
            <div className="space-y-4">
              {results.map((profile: any) => (
                <Link
                  key={profile.username}
                  href={`/u/${profile.username}`}
                  className="block bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow"
                >
                  <h3 className="text-xl font-bold text-gray-900">{profile.full_name || profile.username}</h3>
                  <p className="text-gray-600">@{profile.username}</p>
                  {profile.bio && <p className="mt-2 text-gray-700">{profile.bio}</p>}
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : query ? (
        <p className="text-center text-gray-500 py-12">No results found.</p>
      ) : (
        <p className="text-center text-gray-500 py-12">Enter a search query to get started.</p>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-900">Search</h1>
        <div className="mb-8">
          <SearchBar />
        </div>
        <Suspense fallback={<LoadingSpinner size="lg" />}>
          <SearchResults />
        </Suspense>
      </div>
    </main>
  );
}
