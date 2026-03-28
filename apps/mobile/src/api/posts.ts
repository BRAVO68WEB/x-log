import { apiRequest, type RequestContext } from "@/api/client";
import type { PaginatedPostsResponse, PostDetail } from "@/api/types";

export interface PostPayload {
  title: string;
  content_markdown: string;
  banner_url?: string;
  summary?: string;
  hashtags: string[];
  visibility: "public" | "unlisted" | "private";
}

export function listPosts(cursor?: string, context?: RequestContext) {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=20` : "?limit=20";
  return apiRequest<PaginatedPostsResponse>(`/posts${query}`, undefined, context);
}

export function getPost(id: string, context?: RequestContext) {
  return apiRequest<PostDetail>(`/posts/${id}`, undefined, context);
}

export function createPost(payload: PostPayload, context?: RequestContext) {
  return apiRequest<PostDetail>("/posts", {
    method: "POST",
    body: JSON.stringify(payload),
  }, context);
}

export function updatePost(id: string, payload: Partial<PostPayload>, context?: RequestContext) {
  return apiRequest<{ message: string }>(`/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  }, context);
}

export function publishPost(id: string, context?: RequestContext) {
  return apiRequest<{ message: string }>(`/posts/${id}/publish`, {
    method: "POST",
  }, context);
}
