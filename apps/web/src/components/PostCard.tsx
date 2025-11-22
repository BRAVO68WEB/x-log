import Link from "next/link";

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
  like_count,
}: PostCardProps) {
  return (
    <article className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-gray-200">
      {banner_url && (
        <Link href={`/post/${id}`}>
          <img
            src={banner_url}
            alt={title}
            className="w-full h-48 object-cover"
          />
        </Link>
      )}
      <div className="p-6">
        <Link href={`/post/${id}`}>
          <h2 className="text-2xl font-bold mb-2 hover:text-blue-600 transition-colors text-gray-900">
            {title}
          </h2>
        </Link>
        {summary && (
          <p className="text-gray-600 mb-4 line-clamp-3">{summary}</p>
        )}
        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-2">
            <Link
              href={`/u/${author.username}`}
              className="hover:text-blue-600 transition-colors"
            >
              {author.full_name || author.username}
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
          <div className="flex items-center gap-4">
            <span>❤️ {like_count}</span>
          </div>
        </div>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag) => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}&type=post`}
                className="text-sm text-blue-600 hover:text-blue-800"
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

