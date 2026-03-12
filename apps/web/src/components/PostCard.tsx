import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
  flat = false,
}: PostCardProps) {
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
          <h2 className="text-2xl font-bold mb-2 hover:text-primary transition-colors font-heading">
            {title}
          </h2>
        </Link>
        {summary && (
          <p className="text-muted-foreground mb-4 line-clamp-3">{summary}</p>
        )}
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
                <time dateTime={published_at}>
                  {new Date(published_at).toLocaleDateString()}
                </time>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <svg
              className="w-4 h-4"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
            <span>{like_count}</span>
          </div>
        </div>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((tag) => (
              <Link
                key={tag}
                href={`/search?hashtag=${encodeURIComponent(tag)}&type=post`}
              >
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

  return (
    <Card className="overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5">
      {content}
    </Card>
  );
}
