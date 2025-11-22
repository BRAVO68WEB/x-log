"use client";

import { PostCard } from "./PostCard";
import { LoadingSpinner } from "./LoadingSpinner";
import { Button } from "./Button";
import { usePosts } from "@/hooks/usePosts";

interface PostListProps {
  author?: string;
}

export function PostList({ author }: PostListProps) {
  const { posts, loading, hasMore, loadMore, error } = usePosts({
    author,
    limit: 20,
    autoLoad: true,
  });

  if (loading && posts.length === 0) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No posts found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <PostCard key={post.id} {...post} />
      ))}
      {hasMore && (
        <div className="flex justify-center py-6">
          <Button onClick={loadMore} disabled={loading}>
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}

