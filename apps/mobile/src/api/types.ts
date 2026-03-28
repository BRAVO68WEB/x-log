export interface User {
  id: string;
  username: string;
  email: string | null;
  role: "admin" | "author" | "reader";
  created_at: string;
  avatar_url?: string | null;
}

export interface PostAuthor {
  username: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface PostSummary {
  id: string;
  title: string;
  banner_url?: string | null;
  content_markdown: string;
  hashtags: string[];
  like_count: number;
  author: PostAuthor;
  published_at: string | null;
  updated_at: string;
  visibility: "public" | "unlisted" | "private";
}

export interface PostDetail extends PostSummary {
  url: string;
  content_html: string;
  content_blocks_json?: Record<string, unknown> | null;
  summary?: string | null;
  author_id: string;
}

export interface PaginatedPostsResponse {
  items: PostSummary[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface MobileAuthResponse {
  token: string;
  expires_at: string;
  user: User;
}

export interface InstanceSummary {
  instance_name: string;
  instance_description: string | null;
  instance_domain: string;
  total_public_posts: number;
  primary_profile: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    bio: string | null;
  } | null;
}

export interface Profile {
  username: string;
  full_name: string | null;
  bio: string | null;
  social_github: string | null;
  social_x: string | null;
  social_youtube: string | null;
  social_reddit: string | null;
  social_linkedin: string | null;
  social_website: string | null;
  support_url: string | null;
  support_text: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  nostr_pubkey: string | null;
  has_nostr_privkey: boolean;
  instance_domain?: string;
  actor_url?: string;
}
