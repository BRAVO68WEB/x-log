import { z } from "zod";

// Post schemas
export const PostCreateSchema = z.object({
  title: z.string().min(1).max(200),
  banner_url: z.string().url().optional(),
  content_blocks: z.array(z.any()).min(1),
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
  open_registrations: z.boolean().default(false),
  smtp_url: z.string().url().optional(),
});

// Search schemas
export const SearchQuerySchema = z.object({
  q: z.string().min(1),
  type: z.enum(["post", "profile"]).optional(),
  limit: z.string().transform(Number).pipe(z.number().int().min(1).max(100)).default("20"),
  cursor: z.string().optional(),
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

