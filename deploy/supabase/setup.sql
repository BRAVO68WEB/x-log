-- x-log Database Setup for Supabase / External PostgreSQL
-- Run this script against your Supabase SQL Editor or external PostgreSQL database.
-- This creates all required tables and indexes for x-log.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 001_initial
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255),
  password_hash VARCHAR(255),
  role VARCHAR(50) NOT NULL DEFAULT 'author' CHECK (role IN ('admin', 'author', 'reader')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255),
  bio TEXT,
  social_github VARCHAR(500),
  social_x VARCHAR(500),
  social_youtube VARCHAR(500),
  social_reddit VARCHAR(500),
  social_linkedin VARCHAR(500),
  social_website VARCHAR(500),
  support_url VARCHAR(500),
  support_text TEXT,
  avatar_url VARCHAR(500),
  banner_url VARCHAR(500),
  nostr_pubkey VARCHAR(64),
  nostr_privkey VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS user_keys (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_key_pem TEXT NOT NULL,
  private_key_pem TEXT NOT NULL,
  key_id VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(255) PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  banner_url VARCHAR(1000),
  content_markdown TEXT NOT NULL,
  content_blocks_json JSONB,
  summary TEXT,
  hashtags TEXT[] DEFAULT '{}',
  like_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  visibility VARCHAR(50) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
  ap_object_id VARCHAR(1000) NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_posts_author_published ON posts(author_id, published_at);
CREATE INDEX IF NOT EXISTS idx_posts_content_fts ON posts USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content_markdown, '')));
CREATE INDEX IF NOT EXISTS idx_posts_hashtags ON posts USING gin(hashtags);

CREATE TABLE IF NOT EXISTS post_hashtags (
  post_id VARCHAR(255) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag VARCHAR(255) NOT NULL,
  PRIMARY KEY (post_id, tag)
);

-- ============================================================
-- 002_following
-- ============================================================

CREATE TABLE IF NOT EXISTS followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remote_actor VARCHAR(1000) NOT NULL,
  inbox_url VARCHAR(1000) NOT NULL,
  remote_username VARCHAR(255),
  remote_domain VARCHAR(255),
  approved BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(local_user_id, remote_actor)
);

CREATE TABLE IF NOT EXISTS following (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remote_actor VARCHAR(1000) NOT NULL,
  inbox_url VARCHAR(1000) NOT NULL,
  activity_id VARCHAR(1000) NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- 003_deliveries_metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id VARCHAR(1000) NOT NULL,
  remote_inbox VARCHAR(1000) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  post_id VARCHAR(255) REFERENCES posts(id) ON DELETE SET NULL,
  activity_json JSONB
);

-- ============================================================
-- 004_replay_cache
-- ============================================================

CREATE TABLE IF NOT EXISTS replay_cache (
  key VARCHAR(500) PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- 005_outbox_activities
-- ============================================================

CREATE TABLE IF NOT EXISTS outbox_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id VARCHAR(1000) NOT NULL UNIQUE,
  type VARCHAR(100) NOT NULL,
  object_id VARCHAR(1000) NOT NULL,
  raw JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- 006_oidc_accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS oidc_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(255) NOT NULL,
  provider_account_id VARCHAR(500) NOT NULL,
  email VARCHAR(255),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  name VARCHAR(255),
  picture VARCHAR(1000),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS oidc_pending_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state VARCHAR(500) NOT NULL UNIQUE,
  provider VARCHAR(255) NOT NULL,
  provider_account_id VARCHAR(500) NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  picture VARCHAR(1000),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  oidc_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  expires_at TIMESTAMP NOT NULL
);

-- ============================================================
-- 007-008_nostr_keys (already in user_profiles)
-- ============================================================

-- nostr_pubkey and nostr_privkey columns added in user_profiles above

-- ============================================================
-- 009_follower_display_name
-- ============================================================

-- remote_username and remote_domain already in followers table definition

-- ============================================================
-- 010_following_enabled
-- ============================================================

-- Will be added with instance_settings below

-- ============================================================
-- 011_media
-- ============================================================

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(500) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_type VARCHAR(50) NOT NULL CHECK (asset_type IN ('banner', 'post_attachment')),
  post_id VARCHAR(255) REFERENCES posts(id) ON DELETE SET NULL,
  size INTEGER NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- ============================================================
-- 012-013_instance_settings
-- ============================================================

CREATE TABLE IF NOT EXISTS instance_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  instance_name VARCHAR(255) NOT NULL DEFAULT 'x-log',
  instance_description TEXT,
  instance_domain VARCHAR(255) NOT NULL DEFAULT 'localhost',
  open_registrations BOOLEAN NOT NULL DEFAULT false,
  admin_email VARCHAR(255),
  smtp_url VARCHAR(1000),
  federation_enabled BOOLEAN NOT NULL DEFAULT true,
  following_enabled BOOLEAN NOT NULL DEFAULT false,
  use_profile_as_landing BOOLEAN NOT NULL DEFAULT false,
  theme_id VARCHAR(100) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO instance_settings (id, instance_domain)
VALUES (1, 'localhost')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 014_post_likes_and_inbox_metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR(255) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  actor VARCHAR(500) NOT NULL,
  activity_id VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(post_id, actor)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

-- Add local_user_id to inbox_objects if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inbox_objects' AND column_name = 'local_user_id'
  ) THEN
    ALTER TABLE inbox_objects ADD COLUMN local_user_id UUID REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS inbox_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(100) NOT NULL,
  actor VARCHAR(1000) NOT NULL,
  object_id VARCHAR(1000) NOT NULL,
  local_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  raw JSONB,
  received_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inbox_objects_local_user_received ON inbox_objects(local_user_id, received_at);
CREATE INDEX IF NOT EXISTS idx_inbox_objects_actor_received ON inbox_objects(actor, received_at);

-- ============================================================
-- 019_bookmarks
-- ============================================================

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id VARCHAR(255) REFERENCES posts(id) ON DELETE CASCADE,
  url TEXT,
  post_title TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_url ON bookmarks(user_id, url);

-- ============================================================
-- 020_feature_flags
-- ============================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO feature_flags (key, enabled) VALUES
  ('code_snippets', false),
  ('link_archive', false),
  ('ai_writer', false),
  ('password_reset', false),
  ('custom_post_meta', false),
  ('bookmarks', false),
  ('reposts', false),
  ('threads', false),
  ('short_posts', false),
  ('scheduled_posts', false),
  ('trending', false),
  ('analytics', false),
  ('dms', false),
  ('custom_themes', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 021_password_resets
-- ============================================================

CREATE TABLE IF NOT EXISTS password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);

-- ============================================================
-- 022_post_meta
-- ============================================================

CREATE TABLE IF NOT EXISTS post_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id VARCHAR(255) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(post_id, key)
);

CREATE INDEX IF NOT EXISTS idx_post_meta_post_id ON post_meta(post_id);

-- ============================================================
-- Cleanup job for replay_cache (run periodically via cron)
-- ============================================================

-- DELETE FROM replay_cache WHERE created_at < now() - INTERVAL '30 minutes';
