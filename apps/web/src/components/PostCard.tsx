"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { postsApi, bookmarksApi, repostsApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery } from "react-query";

interface PostCardProps {
  id: string;
  title: string;
  summary?: string | null;
  author: {
    username: string;
    full_name?: string | null;
    avatar_url?: string | null;
  };
  published_at: string | null;
  banner_url?: string | null;
  hashtags: string[];
  like_count: number;
  liked_by_me?: boolean;
  flat?: boolean;
}

export function PostCard({
  id,
  title,
  summary,
  author,
  published_at,
  banner_url,
  hashtags,
  like_count,
  liked_by_me = false,
  flat = false,
}: PostCardProps) {
  const { isAuthenticated } = useAuth();
  const [liked, setLiked] = useState(liked_by_me);
  const [count, setCount] = useState(like_count);

  // Bookmark state
  const { data: bookmarkData } = useQuery(
    ["bookmark-check", id],
    () => bookmarksApi.check(id),
    { enabled: isAuthenticated, staleTime: 60_000 }
  );
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkDbId, setBookmarkDbId] = useState<string | null>(null);

  // Sync bookmark state from query
  useState(() => {
    if (bookmarkData) {
      setBookmarked(bookmarkData.bookmarked);
      setBookmarkDbId(bookmarkData.id);
    }
  });

  const bookmarkMutation = useMutation(
    async () => {
      if (bookmarked && bookmarkDbId) {
        await bookmarksApi.delete(bookmarkDbId);
      } else {
        const result = await bookmarksApi.create({ postId: id });
        setBookmarkDbId(result.id);
      }
    },
    {
      onMutate: () => {
        setBookmarked((prev) => !prev);
      },
      onError: () => {
        setBookmarked((prev) => !prev);
      },
    }
  );

  const [reposted, setReposted] = useState(false);
  const repostMutation = useMutation(
    async () => {
      if (reposted) {
        await repostsApi.unrepost(id);
      } else {
        await repostsApi.repost(id);
      }
    },
    {
      onMutate: () => setReposted((prev) => !prev),
      onError: () => setReposted((prev) => !prev),
    }
  );

  const likeMutation = useMutation(async () => (liked ? postsApi.unlike(id) : postsApi.like(id)), {
    onMutate: () => {
      setLiked((current) => !current);
      setCount((current) => current + (liked ? -1 : 1));
    },
    onSuccess: (data) => {
      setLiked(data.liked_by_me);
      setCount(data.like_count);
    },
    onError: () => {
      setLiked(liked);
      setCount(like_count);
    },
  });

  const handleLike = () => {
    if (!isAuthenticated) {
      window.location.href = `/login?redirect=${encodeURIComponent(`/post/${id}`)}`;
      return;
    }
    likeMutation.mutate();
  };

  const content = (
    <>
      {banner_url && (
        <Link href={`/post/${id}`}>
          <div className="relative w-full h-48">
            <Image
              src={banner_url}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
              className="object-cover"
              unoptimized
            />
          </div>
        </Link>
      )}
      <CardContent className={banner_url ? "p-6" : "p-6 pt-6"}>
        <Link href={`/post/${id}`}>
          <h2 className="text-2xl font-normal tracking-[-0.02em] leading-tight mb-2 hover:text-primary transition-colors font-heading">
            {title}
          </h2>
        </Link>
        {summary && <p className="text-muted-foreground mb-4 line-clamp-3">{summary}</p>}
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <Link
              href={`/u/${author.username}`}
              className="hover:text-primary transition-colors flex items-center gap-2"
            >
              <Avatar className="h-7 w-7">
                {author.avatar_url ? (
                  <AvatarImage
                    src={author.avatar_url}
                    alt={author.full_name?.split(" ")[0] || author.username}
                  />
                ) : (
                  <AvatarFallback>
                    {(author.full_name || author.username)[0]?.toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <span>{author.full_name?.split(" ")[0] || author.username}</span>
            </Link>
            {published_at && (
              <>
                <span>·</span>
                <time dateTime={published_at}>{new Date(published_at).toLocaleDateString()}</time>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleLike}
            disabled={likeMutation.isLoading}
            className={[
              "flex items-center gap-1 rounded-full px-2 py-1 transition-colors",
              liked
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            ].join(" ")}
            aria-label={liked ? "Unlike post" : "Like post"}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span>{count}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                window.location.href = `/login?redirect=${encodeURIComponent(`/post/${id}`)}`;
                return;
              }
              bookmarkMutation.mutate();
            }}
            disabled={bookmarkMutation.isLoading}
            className={[
              "flex items-center gap-1 rounded-full px-2 py-1 transition-colors",
              bookmarked
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            ].join(" ")}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark post"}
          >
            <svg className="w-4 h-4" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                window.location.href = `/login?redirect=${encodeURIComponent(`/post/${id}`)}`;
                return;
              }
              repostMutation.mutate();
            }}
            disabled={repostMutation.isLoading}
            className={[
              "flex items-center gap-1 rounded-full px-2 py-1 transition-colors",
              reposted
                ? "text-green-600 bg-green-600/10"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            ].join(" ")}
            aria-label={reposted ? "Undo repost" : "Repost"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          </button>
        </div>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <Link key={tag} href={`/search?hashtag=${encodeURIComponent(tag)}&type=post`}>
                <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/60">
                  #{tag}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </>
  );

  if (flat) {
    return <div className="overflow-hidden h-full">{content}</div>;
  }

  return <Card className="overflow-hidden transition-colors hover:border-input">{content}</Card>;
}
