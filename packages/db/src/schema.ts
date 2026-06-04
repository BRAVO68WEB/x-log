import type { ColumnType } from "kysely";

export type UserRole = "admin" | "author" | "reader";
export type PostVisibility = "public" | "unlisted" | "private";
export type DeliveryStatus = "pending" | "sent" | "failed" | "retrying";
export type MediaAssetType = "banner" | "post_attachment";
export type InstanceThemeId =
  | "system"
  | "xlog-default"
  | "blues"
  | "marigold"
  | "aurora"
  | "sunburst"
  | "monochrome"
  | "mocha"
  | "amoled"
  | "off-white"
  | "dracula"
  | "mint-grove"
  | "neon-circuit"
  | "signal"
  | "retro-classic";

export interface UsersTable {
  id: string; // uuid
  username: string;
  email: string | null;
  password_hash: string | null;
  role: UserRole;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, Date>;
}

export interface UserProfilesTable {
  user_id: string; // FK users.id
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
  nostr_privkey: string | null;
}

export interface UserKeysTable {
  user_id: string; // FK users.id
  public_key_pem: string;
  private_key_pem: string; // encrypted at rest
  key_id: string;
  created_at: ColumnType<Date, never, never>;
}

export interface PostsTable {
  id: string; // snowflake
  author_id: string; // FK users.id
  title: string;
  banner_url: string | null;
  content_markdown: string;
  content_blocks_json: ColumnType<Record<string, unknown>, unknown, unknown>; // jsonb
  summary: string | null;
  hashtags: string[]; // text[]
  like_count: number; // default 0
  published_at: Date | null;
  updated_at: ColumnType<Date, never, Date>;
  visibility: PostVisibility;
  ap_object_id: string; // unique
  // New columns for features
  repost_of: string | null;
  thread_id: string | null;
  thread_position: number | null;
  scheduled_at: Date | null;
}

export interface PostHashtagsTable {
  post_id: string; // FK posts.id
  tag: string; // lowercase
}

export interface FollowersTable {
  id: string; // uuid, PK
  local_user_id: string; // FK users.id
  remote_actor: string;
  inbox_url: string;
  remote_username: string | null;
  remote_domain: string | null;
  approved: boolean; // default true
  created_at: ColumnType<Date, never, never>;
}

export interface DeliveriesTable {
  id: string; // uuid, PK
  activity_id: string;
  remote_inbox: string;
  status: DeliveryStatus;
  attempt_count: number;
  last_error: string | null;
  updated_at: ColumnType<Date, never, Date>;
  user_id: string | null;
  post_id: string | null;
  activity_json: ColumnType<Record<string, unknown> | null, unknown, unknown>;
}

export interface FollowingTable {
  id: string; // uuid, PK
  local_user_id: string; // FK users.id
  remote_actor: string;
  inbox_url: string;
  activity_id: string;
  accepted: boolean; // default false
  created_at: ColumnType<Date, never, never>;
}

export interface OutboxActivitiesTable {
  id: string; // uuid, PK
  user_id: string; // FK users.id
  activity_id: string; // globally unique ActivityStreams id
  type: string; // e.g., Create, Follow, Like, Accept
  object_id: string; // URL of object or id
  raw: ColumnType<Record<string, unknown>, unknown, unknown>; // jsonb
  created_at: ColumnType<Date, never, never>;
}

export interface ReplayCacheTable {
  key: string; // signature + date composite
  created_at: ColumnType<Date, never, never>;
}

export interface InboxObjectsTable {
  id: string; // uuid, PK
  type: string;
  actor: string;
  object_id: string;
  local_user_id: string | null;
  raw: ColumnType<Record<string, unknown>, unknown, unknown>; // jsonb
  received_at: ColumnType<Date, never, never>;
}

export interface PostLikesTable {
  id: string; // uuid, PK
  post_id: string; // FK posts.id
  user_id: string | null; // FK users.id for local likes
  actor: string;
  activity_id: string;
  created_at: ColumnType<Date, never, never>;
}

export interface InstanceSettingsTable {
  id: number; // singleton PK = 1
  instance_name: string;
  instance_description: string | null;
  instance_domain: string;
  open_registrations: boolean;
  admin_email: string | null;
  smtp_url: string | null;
  federation_enabled: boolean;
  following_enabled: boolean;
  use_profile_as_landing: boolean;
  theme_id: ColumnType<InstanceThemeId, InstanceThemeId | undefined, InstanceThemeId>;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, Date>;
}

export interface OIDCAccountsTable {
  id: string; // uuid, PK
  user_id: string; // FK users.id
  provider: string;
  provider_account_id: string; // sub claim from OIDC
  email: string | null;
  email_verified: boolean;
  name: string | null;
  picture: string | null;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, never, Date>;
}

export interface OIDCPendingLinksTable {
  id: string; // uuid, PK
  state: string; // OAuth state parameter
  provider: string;
  provider_account_id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  email_verified: boolean;
  oidc_data: ColumnType<Record<string, unknown> | null, unknown, unknown>; // jsonb
  created_at: ColumnType<Date, never, never>;
  expires_at: Date;
}

export interface MediaTable {
  id: ColumnType<string, string | undefined, string>; // uuid, auto-generated
  filename: string;
  url: string;
  user_id: string; // FK users.id
  asset_type: MediaAssetType;
  post_id: string | null; // FK posts.id
  size: number;
  mime_type: string;
  created_at: ColumnType<Date, never, never>;
}

export interface PasswordResetsTable {
  id: string; // uuid, PK - manually set
  user_id: string; // FK users.id
  token_hash: string; // hashed token
  expires_at: Date;
  used_at: ColumnType<Date, never, Date> | null;
  created_at: ColumnType<Date, never, never>; // defaults to now()
}

export interface FeatureFlagsTable {
  feature: string; // PK
  enabled: boolean;
  updated_at: ColumnType<Date, Date, Date>;
}

export interface SnippetsTable {
  id: string;
  title: string;
  description: string | null;
  user_id: string;
  language: string;
  code: string;
  visibility: string;
  current_version: number;
  fork_of: string | null;
  tags: string;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, Date, Date>;
}

export interface SnippetVersionsTable {
  id: string;
  snippet_id: string;
  version: number;
  code: string;
  changelog: string | null;
  created_at: ColumnType<Date, never, never>;
}

export interface LinksTable {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  og_image: string | null;
  user_id: string;
  archived_at: ColumnType<Date, never, never>;
  views: number;
  is_public: boolean;
  tags: string;
  archived_url: string | null;
}

export interface PostMetaTable {
  id: string;
  post_id: string;
  key: string;
  value: string;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, Date, Date>;
}

export interface BookmarksTable {
  id: string;
  user_id: string;
  post_id: string;
  created_at: ColumnType<Date, never, never>;
}

export interface Database {
  users: UsersTable;
  user_profiles: UserProfilesTable;
  user_keys: UserKeysTable;
  posts: PostsTable;
  post_hashtags: PostHashtagsTable;
  followers: FollowersTable;
  following: FollowingTable;
  outbox_activities: OutboxActivitiesTable;
  deliveries: DeliveriesTable;
  inbox_objects: InboxObjectsTable;
  post_likes: PostLikesTable;
  instance_settings: InstanceSettingsTable;
  replay_cache: ReplayCacheTable;
  oidc_accounts: OIDCAccountsTable;
  oidc_pending_links: OIDCPendingLinksTable;
  media: MediaTable;
  feature_flags: FeatureFlagsTable;
  password_resets: PasswordResetsTable;
  snippets: SnippetsTable;
  snippet_versions: SnippetVersionsTable;
  links: LinksTable;
  post_meta: PostMetaTable;
  bookmarks: BookmarksTable;
  threads: ThreadsTable;
  post_views: PostViewsTable;
  analytics_aggregates: AnalyticsAggregatesTable;
  trending: TrendingTable;
}

export interface ThreadsTable {
  id: string;
  user_id: string;
  title: string | null;
  created_at: ColumnType<Date, never, never>;
  updated_at: ColumnType<Date, Date, Date>;
}

export interface PostViewsTable {
  id: string;
  post_id: string;
  viewed_at: ColumnType<Date, never, never>;
  referrer: string | null;
  user_agent: string | null;
}

export interface AnalyticsAggregatesTable {
  id: string;
  user_id: string;
  date: string;
  posts_count: number;
  views_count: number;
  likes_count: number;
  reposts_count: number;
  followers_count: number;
}

export interface TrendingTable {
  id: string;
  hashtag: string;
  score: number;
  hour: Date;
}
