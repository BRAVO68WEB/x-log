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
        <p className="text-light-love dark:text-dark-love">Error: {error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-light-muted dark:text-dark-muted">No posts found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <PostCard key={post.id} {...post} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center py-6">
          <Button onClick={loadMore} disabled={loading}>
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </>
  );
}
