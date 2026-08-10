import { z } from "zod";

// Post schemas
export const PostCreateSchema = z.object({
  title: z.string().min(1).max(200),
  banner_url: z.string().url().optional(),
  content_blocks: z.record(z.any()).optional(), // ProseMirror/TipTap document object
  content_markdown: z.string().min(1),
  hashtags: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/i)).max(20),
  visibility: z.enum(["public", "unlisted", "private"]).default("public"),
  summary: z.string().optional(),
});

export const PostUpdateSchema = PostCreateSchema.partial();

export const PostResponseSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  banner_url: z.string().url().optional().nullable(),
  content_html: z.string(),
  content_markdown: z.string(),
  hashtags: z.array(z.string()),
  like_count: z.number().int(),
  liked_by_me: z.boolean().optional(),
  author: z.object({
    username: z.string(),
    full_name: z.string().optional().nullable(),
    avatar_url: z.string().url().optional().nullable(),
  }),
  published_at: z.string().nullable(),
  updated_at: z.string(),
  visibility: z.enum(["public", "unlisted", "private"]),
});

// Auth schemas
export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const MobileAuthResponseSchema = z.object({
  token: z.string().min(1),
  expires_at: z.string(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    email: z.string().nullable(),
    role: z.enum(["admin", "author", "reader"]),
    created_at: z.string(),
  }),
});

export const UserResponseSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().nullable(),
  role: z.enum(["admin", "author", "reader"]),
  created_at: z.string(),
});

// Profile schemas
export const ProfileUpdateSchema = z.object({
  full_name: z.string().optional(),
  bio: z.string().optional(),
  social_github: z.string().url().optional(),
  social_x: z.string().url().optional(),
  social_youtube: z.string().url().optional(),
  social_reddit: z.string().url().optional(),
  social_linkedin: z.string().url().optional(),
  social_website: z.string().url().optional(),
  support_url: z.string().url().optional(),
  support_text: z.string().optional(),
  avatar_url: z.string().url().optional(),
  banner_url: z.string().url().optional(),
  nostr_pubkey: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "Must be a 64-character hex public key")
    .optional(),
  nostr_privkey: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "Must be a 64-character hex private key")
    .optional(),
});

export const ProfileResponseSchema = z.object({
  username: z.string(),
  full_name: z.string().nullable(),
  bio: z.string().nullable(),
  social_github: z.string().nullable(),
  social_x: z.string().nullable(),
  social_youtube: z.string().nullable(),
  social_reddit: z.string().nullable(),
  social_linkedin: z.string().nullable(),
  social_website: z.string().nullable(),
  support_url: z.string().nullable(),
  support_text: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  banner_url: z.string().url().nullable(),
  nostr_pubkey: z.string().nullable(),
  has_nostr_privkey: z.boolean(),
});

export const InstanceSummaryResponseSchema = z.object({
  instance_name: z.string(),
  instance_description: z.string().nullable(),
  instance_domain: z.string(),
  use_profile_as_landing: z.boolean(),
  theme_id: z.enum([
    "system",
    "xlog-default",
    "blues",
    "marigold",
    "aurora",
    "sunburst",
    "monochrome",
    "mocha",
    "amoled",
    "off-white",
    "dracula",
    "mint-grove",
    "neon-circuit",
    "signal",
    "retro-classic",
  ]),
  /** Derived: solo when ≤1 local user, multi otherwise */
  instance_mode: z.enum(["solo", "multi"]).optional(),
  local_user_count: z.number().int().min(0).optional(),
  open_registrations: z.boolean().optional(),
  total_public_posts: z.number().int().min(0),
  primary_profile: z
    .object({
      username: z.string(),
      full_name: z.string().nullable(),
      avatar_url: z.string().nullable(),
      banner_url: z.string().nullable(),
      bio: z.string().nullable(),
    })
    .nullable(),
});

// Onboarding schemas
export const OnboardingStateSchema = z.object({
  completed: z.boolean(),
  step: z.number().int().min(1).max(6),
});

export const OnboardingCompleteSchema = z.object({
  instance_name: z.string().min(1),
  instance_description: z.string().optional(),
  instance_domain: z.string().min(1),
  admin_username: z.string().min(1).max(255),
  admin_password: z.string().min(8),
  admin_email: z.string().email().optional(),
  smtp_url: z.string().url().optional(),
});

// Search schemas
export const SearchQuerySchema = z
  .object({
    q: z.string().min(1).optional(),
    hashtag: z
      .string()
      .regex(/^[a-z0-9_]{1,64}$/i)
      .optional(),
    type: z.enum(["post", "profile"]).optional(),
    limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("20"),
    cursor: z.string().optional(),
  })
  .refine((data) => Boolean(data.q) || Boolean(data.hashtag), {
    message: "q or hashtag is required",
  });

// Pagination schemas
export const PaginationQuerySchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("20"),
  cursor: z.string().optional(),
});

// Error response schema (RFC 7807)
export const ProblemDetailSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
});

// OIDC schemas
export const OIDCCallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const OIDCLinkAccountSchema = z.object({
  email: z.string().email().optional(), // Optional if user is logged in
  password: z.string().min(1).optional(), // Optional if user is logged in
  state: z.string().min(1), // State from pending link
});

export const OIDCAccountResponseSchema = z.object({
  id: z.string(),
  provider: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  created_at: z.string(),
});

// Post Meta schemas
export const PostMetaCreateSchema = z.object({
  key: z.string().min(1).max(256),
  value: z.string().max(4096),
});

export const PostMetaBulkUpdateSchema = z.object({
  meta: z.record(z.string().max(256), z.string().max(4096)),
});

export const PostMetaResponseSchema = z.object({
  meta: z.record(z.string(), z.string()),
});

// Snippet schemas
export const SnippetCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  language: z.string().min(1).max(50),
  code: z.string().min(1),
  visibility: z.enum(["public", "followers", "private"]).default("public"),
  tags: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/i)).max(20).default([]),
});

export const SnippetUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  language: z.string().min(1).max(50).optional(),
  code: z.string().min(1).optional(),
  visibility: z.enum(["public", "followers", "private"]).optional(),
  tags: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/i)).max(20).optional(),
  changelog: z.string().max(500).optional(),
});

export const SnippetResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  language: z.string(),
  code: z.string(),
  visibility: z.string(),
  current_version: z.number().int(),
  fork_of: z.string().nullable(),
  tags: z.array(z.string()),
  view_count: z.number().int(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    full_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
  }),
  created_at: z.string(),
  updated_at: z.string(),
});

export const SnippetVersionSchema = z.object({
  id: z.string(),
  version: z.number().int(),
  code: z.string(),
  changelog: z.string().nullable(),
  created_at: z.string(),
});

// Link schemas
export const LinkCreateSchema = z.object({
  url: z.string().url(),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/i)).max(20).default([]),
});

export const LinkUpdateSchema = z.object({
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().regex(/^[a-z0-9_]{1,64}$/i)).max(20).optional(),
  is_public: z.boolean().optional(),
});

export const LinkResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  thumbnail: z.string().nullable(),
  og_image: z.string().nullable(),
  tags: z.array(z.string()),
  view_count: z.number().int(),
  is_public: z.boolean(),
  archived_url: z.string().nullable(),
  user: z.object({
    id: z.string(),
    username: z.string(),
    full_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
  }),
  archived_at: z.string(),
});

// AI schemas
export const AITitleRequestSchema = z.object({
  content: z.string().min(1).max(50000),
});

export const AIOutlineRequestSchema = z.object({
  topic: z.string().min(1).max(5000),
});

export const AIEnhanceRequestSchema = z.object({
  content: z.string().min(1).max(50000),
  action: z.enum(["expand", "condense", "engaging", "fix-grammar"]),
});

export const AIMetaRequestSchema = z.object({
  content: z.string().min(1).max(50000),
});

export const AITranslateRequestSchema = z.object({
  content: z.string().min(1).max(50000),
  language: z.string().min(1).max(50),
});
