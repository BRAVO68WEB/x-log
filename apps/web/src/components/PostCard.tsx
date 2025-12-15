import Link from "next/link";
import Image from "next/image";

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
}

export function PostCard({
  id,
  title,
  summary,
  author,
  published_at,
  banner_url,
  hashtags,
}: PostCardProps) {
  return (
    <article className="bg-light-surface dark:bg-dark-surface opacity-100 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-light-highlight-med dark:border-dark-highlight-med hover:border-light-highlight-high dark:hover:border-dark-highlight-high">
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
      <div className="p-6">
        <Link href={`/post/${id}`}>
          <h2 className="text-2xl font-bold mb-2 hover:text-light-pine dark:hover:text-dark-foam transition-colors text-light-text dark:text-dark-text">
            {title}
          </h2>
        </Link>
        {summary && (
          <p className="text-light-muted dark:text-dark-muted mb-4 line-clamp-3">{summary}</p>
        )}
        <div className="flex items-center justify-between text-sm text-light-subtle dark:text-dark-subtle mb-4">
          <div className="flex items-center gap-2">
            <Link
              href={`/u/${author.username}`}
              className="hover:text-light-pine dark:hover:text-dark-foam transition-colors flex items-center"
            >
              <div className="flex items-center">
                {author.avatar_url && (
                  <Image
                    src={author.avatar_url}
                    alt={author.full_name?.split(" ")[0] || author.username}
                    width={32}
                    height={32}
                    className="rounded-full mr-2"
                    unoptimized
                  />
                )}
                {author.full_name?.split(" ")[0] || author.username}
              </div>
            </Link>
            {published_at && (
              <>
                <span>•</span>
                <time dateTime={published_at}>
                  {new Date(published_at).toLocaleDateString()}
                </time>
              </>
            )}
          </div>
          {/* <div className="flex items-center gap-4">
            <span>❤️ {like_count}</span>
          </div> */}
        </div>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag) => (
              <Link
                key={tag}
                href={`/search?hashtag=${encodeURIComponent(tag)}&type=post`}
                className="text-sm text-light-pine dark:text-dark-foam hover:text-light-foam dark:hover:text-dark-pine transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
