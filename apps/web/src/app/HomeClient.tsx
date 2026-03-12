"use client";

import { PostCard } from "@/components/PostCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import {
  BentoGrid,
  BentoCard,
  BentoCardContent,
} from "@/components/ui/bento-grid";
import { usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import Image from "next/image";

export default function HomeClient() {
  const { isAuthenticated } = useAuth();
  const { posts, loading, hasMore, loadMore, error } = usePosts({
    limit: 12,
    autoLoad: true,
  });

  if (loading && posts.length === 0) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto text-center py-12">
          <p className="text-destructive">Error: {error}</p>
        </div>
      </main>
    );
  }

  if (posts.length === 0) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-7xl mx-auto text-center py-12">
          <p className="text-muted-foreground">No posts found.</p>
        </div>
      </main>
    );
  }

  const [featured, ...rest] = posts;

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <BentoGrid columns={3}>
          {/* Quick action card — only for authenticated users */}
          {isAuthenticated && (
            <BentoCard size="1x1" index={0} accent>
              <BentoCardContent className="p-6 flex flex-col items-center justify-center h-full gap-3">
                <svg
                  className="w-8 h-8 text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <Link href="/editor">
                  <Button>Write a Post</Button>
                </Link>
              </BentoCardContent>
            </BentoCard>
          )}

          {/* Featured post - 2x2 */}
          <BentoCard size="2x2" index={isAuthenticated ? 1 : 0}>
            <div className="h-full flex flex-col">
              {featured.banner_url && (
                <Link href={`/post/${featured.id}`}>
                  <div className="relative w-full h-64">
                    <Image
                      src={featured.banner_url}
                      alt={featured.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 800px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </Link>
              )}
              <div className="p-6 flex-1 flex flex-col">
                <Link href={`/post/${featured.id}`}>
                  <h2 className="text-2xl font-bold mb-2 hover:text-primary transition-colors font-heading">
                    {featured.title}
                  </h2>
                </Link>
                {featured.summary && (
                  <p className="text-muted-foreground mb-4 line-clamp-4 flex-1">
                    {featured.summary}
                  </p>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Link
                    href={`/u/${featured.author.username}`}
                    className="hover:text-primary transition-colors"
                  >
                    {featured.author.full_name?.split(" ")[0] ||
                      featured.author.username}
                  </Link>
                  {featured.published_at && (
                    <>
                      <span>·</span>
                      <time dateTime={featured.published_at}>
                        {new Date(
                          featured.published_at
                        ).toLocaleDateString()}
                      </time>
                    </>
                  )}
                </div>
              </div>
            </div>
          </BentoCard>

          {/* Remaining posts as 1x1 cards */}
          {rest.map((post, i) => (
            <BentoCard key={post.id} size="1x1" index={i + (isAuthenticated ? 2 : 1)}>
              <PostCard {...post} flat />
            </BentoCard>
          ))}

          {/* Load more */}
          {hasMore && (
            <BentoCard size="full" index={posts.length + (isAuthenticated ? 2 : 1)}>
              <BentoCardContent className="p-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? "Loading..." : "Load More"}
                </Button>
              </BentoCardContent>
            </BentoCard>
          )}
        </BentoGrid>
      </div>
    </main>
  );
}
