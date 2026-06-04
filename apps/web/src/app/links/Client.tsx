"use client";

import { useState } from "react";
import { useQuery } from "react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BentoGrid, BentoCard, BentoCardContent } from "@/components/ui/bento-grid";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Search, ExternalLink, Archive, Plus, Globe } from "lucide-react";

interface ArchivedLink {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  og_image: string | null;
  views: number;
  tags: string[];
  archived_url: string | null;
  archived_at: string;
}

function LinkCard({ link }: { link: ArchivedLink }) {
  const waybackUrl = `https://web.archive.org/web/*/${link.url}`;

  return (
    <div className="group">
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block p-4 rounded-lg border hover:bg-accent transition-colors"
      >
        {link.og_image && (
          <div className="relative h-40 -mx-4 -mt-4 mb-4 overflow-hidden rounded-t-lg">
            <img
              src={link.og_image}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate">{link.title || link.url}</h3>
            {link.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{link.description}</p>
            )}
          </div>
          <ExternalLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        </div>
      </a>
      <div className="flex items-center gap-2 mt-2 px-1">
        <a
          href={waybackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
        >
          <Archive className="h-3 w-3" />
          Wayback
        </a>
        <span className="text-xs text-muted-foreground">
          {new Date(link.archived_at).toLocaleDateString()}
        </span>
        {(Array.isArray(link.tags) ? link.tags : []).map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs py-0">
            {tag}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function LinksClient() {
  const [links, setLinks] = useState<ArchivedLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const query = useQuery<ArchivedLink[]>(
    ["links"],
    async () => {
      const res = await fetch("/api/content/links", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load links");
      const data = await res.json();
      return data.items ?? data;
    },
    {
      onSuccess: (data) => setLinks(data),
      onSettled: () => setLoading(false),
    }
  );

  const filteredLinks = links.filter(
    (l) =>
      l.url.toLowerCase().includes(search.toLowerCase()) ||
      (l.title?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (Array.isArray(l.tags)
        ? l.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
        : false)
  );

  if (loading && query.isLoading) {
    return (
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-4xl mx-auto flex justify-center items-center min-h-[400px]">
          <LoadingSpinner size="lg" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-normal tracking-[-0.03em] font-heading">Link Archive</h1>
            <p className="text-muted-foreground mt-2">
              {filteredLinks.length} of {links.length} archived links
            </p>
          </div>
          <a href="/links/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Link
            </Button>
          </a>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search links..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <BentoGrid columns={2}>
          {filteredLinks.length === 0 ? (
            <BentoCard size="full" index={0}>
              <BentoCardContent className="p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                  <Globe className="w-6 h-6 text-muted-foreground" />
                </div>
                <h2 className="text-2xl font-normal tracking-[-0.02em] font-heading mb-2">
                  {search ? "No matching links" : "No links archived yet"}
                </h2>
                <p className="text-muted-foreground mb-4">
                  {search
                    ? "Try a different search term"
                    : "Save links with OGP previews and Wayback access"}
                </p>
                {!search && (
                  <a href="/links/new">
                    <Button variant="outline">Add your first link</Button>
                  </a>
                )}
              </BentoCardContent>
            </BentoCard>
          ) : (
            filteredLinks.map((link, index) => (
              <BentoCard key={link.id} size="full" index={index}>
                <LinkCard link={link} />
              </BentoCard>
            ))
          )}
        </BentoGrid>
      </div>
    </main>
  );
}
