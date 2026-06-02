"use client";

import { useState } from "react";
import { useQuery } from "react-query";
import Link from "next/link";
import { feedApi, type FollowingFeedItem } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function RemotePostCard({ item }: { item: FollowingFeedItem }) {
  return (
    <Card className="overflow-hidden transition-colors hover:border-input">
      <CardContent className="p-6">
        <div className="mb-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <a
            href={item.actor}
            target="_blank"
            rel="noreferrer"
            className="truncate text-primary hover:underline"
          >
            {item.actor_handle || item.actor}
          </a>
          <Badge variant="secondary">{item.type === "Announce" ? "Boost" : "Post"}</Badge>
        </div>
        <a href={item.url} target="_blank" rel="noreferrer">
          <h2 className="text-2xl font-normal tracking-[-0.02em] leading-tight mb-2 hover:text-primary transition-colors font-heading">
            {item.title || "Remote post"}
          </h2>
        </a>
        {item.summary && <p className="mb-4 text-muted-foreground">{item.summary}</p>}
        <div
          className="prose prose-sm max-w-none line-clamp-6"
          dangerouslySetInnerHTML={{ __html: item.content_html }}
        />
        <div className="mt-4 text-xs text-muted-foreground">
          {item.published_at
            ? new Date(item.published_at).toLocaleString()
            : new Date(item.received_at).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FollowingClient() {
  const { isAuthenticated } = useAuth();
  const [cursor, setCursor] = useState<string | undefined>();
  const [items, setItems] = useState<FollowingFeedItem[]>([]);

  const feedQuery = useQuery(
    ["following-feed", cursor],
    () => feedApi.following({ limit: 20, cursor }),
    {
      enabled: isAuthenticated,
      keepPreviousData: true,
      onSuccess: (data) => {
        setItems((current) => (cursor ? [...current, ...data.items] : data.items));
      },
    }
  );

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen py-10 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Following</h1>
          <p className="mt-3 text-muted-foreground">
            Sign in to view posts from followed fediverse profiles.
          </p>
          <Link href="/login?redirect=/following" className="mt-6 inline-block">
            <Button>Login</Button>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-10 px-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Following</h1>
            <p className="mt-2 text-muted-foreground">
              Latest posts received from profiles followed by the primary profile.
            </p>
          </div>
          <Link href="/settings">
            <Button variant="outline">Manage Follows</Button>
          </Link>
        </div>

        {feedQuery.isLoading && items.length === 0 ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : feedQuery.error ? (
          <Card>
            <CardContent className="p-8 text-center text-destructive">
              {feedQuery.error instanceof Error
                ? feedQuery.error.message
                : "Unable to load following feed"}
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-2xl font-normal tracking-[-0.02em] font-heading">
                No followed posts yet
              </h2>
              <p className="mt-2 text-muted-foreground">
                Add profiles in Settings &gt; Follow, then incoming posts will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <RemotePostCard key={item.id} item={item} />
            ))}
            {feedQuery.data?.hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  disabled={feedQuery.isFetching}
                  onClick={() => setCursor(feedQuery.data?.nextCursor)}
                >
                  {feedQuery.isFetching ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
