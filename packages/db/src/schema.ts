import type { ColumnType } from "kysely";

export type UserRole = "admin" | "author" | "reader";
export type PostVisibility = "public" | "unlisted" | "private";
export type DeliveryStatus = "pending" | "sent" | "failed" | "retrying";

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
  raw: ColumnType<Record<string, unknown>, unknown, unknown>; // jsonb
  received_at: ColumnType<Date, never, never>;
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
  instance_settings: InstanceSettingsTable;
  replay_cache: ReplayCacheTable;
  oidc_accounts: OIDCAccountsTable;
  oidc_pending_links: OIDCPendingLinksTable;
}
