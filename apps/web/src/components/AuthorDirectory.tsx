"use client";

import Link from "next/link";
import { useQuery } from "react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BentoCard, BentoCardContent, BentoCardHeader } from "@/components/ui/bento-grid";

type Author = {
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  public_post_count: number;
  profile_path: string;
};

/**
 * Multi-author directory. Renders nothing for solo instances.
 */
export function AuthorDirectory() {
  const query = useQuery(
    ["public-authors"],
    async () => {
      const res = await fetch("/api/public/authors", { credentials: "omit" });
      if (!res.ok) throw new Error("Failed to load authors");
      return res.json() as Promise<{
        instance_mode: "solo" | "multi";
        authors: Author[];
      }>;
    },
    { staleTime: 60_000 }
  );

  if (query.isLoading || query.isError) return null;
  if (query.data?.instance_mode !== "multi") return null;
  if (!query.data.authors.length) return null;

  return (
    <BentoCard size="full" index={0}>
      <BentoCardHeader>
        <h2 className="text-xl font-semibold font-heading">Authors</h2>
        <p className="text-sm text-muted-foreground mt-1">
          People writing on this instance
        </p>
      </BentoCardHeader>
      <BentoCardContent>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {query.data.authors.map((a) => (
            <li key={a.username}>
              <Link
                href={a.profile_path}
                className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  {a.avatar_url ? (
                    <AvatarImage src={a.avatar_url} alt={a.username} />
                  ) : null}
                  <AvatarFallback>
                    {(a.full_name || a.username).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block font-medium truncate">
                    {a.full_name || `@${a.username}`}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    @{a.username} · {a.public_post_count} posts
                  </span>
                  {a.bio && (
                    <span className="mt-1 block text-xs text-muted-foreground line-clamp-2">
                      {a.bio}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </BentoCardContent>
    </BentoCard>
  );
}
