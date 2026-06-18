"use client";

import Link from "next/link";
import Image from "next/image";
import { useInfiniteQuery } from "react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { linksApi, type LinkItem } from "@/lib/api";
import { Plus, Globe, ExternalLink, Eye } from "lucide-react";

export default function LinksListClient() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery(
    ["links"],
    ({ pageParam }) => linksApi.list({ limit: 20, cursor: pageParam }),
    { getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined) }
  );

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Link Archive</h1>
            <p className="text-muted-foreground mt-1">Curated links from the community</p>
          </div>
          <Link href="/links/new">
            <Button><Plus className="h-4 w-4 mr-1" /> Add Link</Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
              <Globe className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-medium mb-2">No links archived yet</h2>
            <p className="text-muted-foreground mb-6">Archive your first link to get started.</p>
            <Link href="/links/new"><Button><Plus className="h-4 w-4 mr-1" /> Add Link</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <LinkCard key={item.id} item={item} />
            ))}
            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
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

function LinkCard({ item }: { item: LinkItem }) {
  const domain = (() => {
    try { return new URL(item.url).hostname; } catch { return item.url; }
  })();

  return (
    <Link href={`/links/${item.id}`}>
      <Card className="overflow-hidden transition-colors hover:border-input cursor-pointer">
        <CardContent className="p-4">
          <div className="flex gap-4">
            {item.og_image && (
              <div className="relative w-24 h-24 rounded-md overflow-hidden shrink-0">
                <Image src={item.og_image} alt="" fill sizes="96px" className="object-cover" unoptimized />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{item.title || domain}</h3>
              {item.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 truncate">
                  <Globe className="h-3 w-3 shrink-0" /> {domain}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {item.view_count}
                </span>
                <span>{new Date(item.archived_at).toLocaleDateString()}</span>
              </div>
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tags.slice(0, 5).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="shrink-0 self-start" onClick={(e) => e.stopPropagation()}>
              <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </a>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
