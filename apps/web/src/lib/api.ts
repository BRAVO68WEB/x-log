/**
 * API Client for x-log
 * Centralized API functions for interacting with the backend
 * All requests are proxied through Next.js API routes
 */

// Use relative URLs to proxy through Next.js API routes
const API_BASE = "/api";

// Helper function to make API requests with credentials
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Remove leading /api if present since we're already proxying through Next.js
  const cleanEndpoint = endpoint.startsWith("/api") ? endpoint.slice(4) : endpoint;

  const response = await fetch(`${API_BASE}${cleanEndpoint}`, {
    ...options,
    credentials: "include", // Include cookies for session
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    // Handle 401 Unauthorized - redirect to login only for protected routes
    if (response.status === 401) {
      // Public routes and auth check endpoints that shouldn't trigger redirect on 401
      const publicEndpoints = ["/api/posts", "/api/profiles", "/api/search", "/api/feeds"];

      // Auth check endpoint - 401 is expected when not logged in
      const isAuthCheck = endpoint === "/api/users/me";

      const isPublicEndpoint = publicEndpoints.some((publicEndpoint) =>
        endpoint.startsWith(publicEndpoint)
      );

      // Only redirect if it's not a public endpoint, not an auth check, and we're not already on the login page
      if (
        !isPublicEndpoint &&
        !isAuthCheck &&
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login")
      ) {
        const currentPath = window.location.pathname + window.location.search;
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        // Return a rejected promise to stop execution
        return Promise.reject(new Error("Unauthorized"));
      }
    }

    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: async (username: string, password: string) => {
    return apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },

  logout: async () => {
    return apiRequest("/api/auth/logout", {
      method: "POST",
    });
  },
};

// Users API
export const usersApi = {
  getMe: async () => {
    return apiRequest("/api/users/me");
  },

  updateMe: async (data: { email?: string }) => {
    return apiRequest("/api/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  changePassword: async (data: { current_password: string; new_password: string }) => {
    return apiRequest<{ message: string }>("/api/users/me/password", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};

// Posts API
export const postsApi = {
  list: async (params?: { limit?: number; cursor?: string; author?: string; mine?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.author) searchParams.set("author", params.author);
    if (params?.mine) searchParams.set("mine", "true");

    const query = searchParams.toString();
    interface PostSummary {
      id: string;
      title: string;
      summary?: string | null;
      banner_url?: string | null;
      content_markdown: string;
      hashtags: string[];
      like_count: number;
      liked_by_me?: boolean;
      author: { username: string; full_name?: string | null; avatar_url?: string | null };
      published_at: string | null;
      updated_at: string;
      visibility: "public" | "unlisted" | "private";
    }
    return apiRequest<{
      items: PostSummary[];
      nextCursor?: string;
      hasMore: boolean;
    }>(`/api/posts${query ? `?${query}` : ""}`);
  },

  get: async (id: string) => {
    return apiRequest<{
      id: string;
      url: string;
      title: string;
      banner_url: string | null;
      content_html: string;
      content_markdown: string;
      content_blocks_json: import("@tiptap/core").JSONContent | null;
      summary: string | null;
      author_id: string;
      hashtags: string[];
      like_count: number;
      liked_by_me?: boolean;
      author: { username: string; full_name?: string | null; avatar_url?: string | null };
      published_at: string | null;
      updated_at: string;
      visibility: "public" | "unlisted" | "private";
    }>(`/api/posts/${id}`);
  },

  create: async (data: {
    title: string;
    content_markdown: string;
    content_blocks?: import("@tiptap/core").JSONContent | string;
    banner_url?: string;
    summary?: string;
    hashtags: string[];
    visibility: "public" | "unlisted" | "private";
  }) => {
    return apiRequest("/api/posts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (
    id: string,
    data: {
      title?: string;
      content_markdown?: string;
      content_blocks?: import("@tiptap/core").JSONContent | string;
      banner_url?: string;
      summary?: string;
      hashtags?: string[];
      visibility?: "public" | "unlisted" | "private";
    }
  ) => {
    return apiRequest(`/api/posts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return apiRequest(`/api/posts/${id}`, {
      method: "DELETE",
    });
  },

  publish: async (id: string) => {
    return apiRequest(`/api/posts/${id}/publish`, {
      method: "POST",
    });
  },

  like: async (id: string) => {
    return apiRequest<{ liked_by_me: boolean; like_count: number }>(`/api/posts/${id}/like`, {
      method: "POST",
    });
  },

  unlike: async (id: string) => {
    return apiRequest<{ liked_by_me: boolean; like_count: number }>(`/api/posts/${id}/like`, {
      method: "DELETE",
    });
  },
};

// Post Meta API
export const postMetaApi = {
  get: async (postId: string) => {
    return apiRequest<{ meta: Record<string, string> }>(
      `/api/posts/${postId}/meta`
    );
  },

  set: async (postId: string, key: string, value: string) => {
    return apiRequest<{ key: string; value: string }>(
      `/api/posts/${postId}/meta`,
      {
        method: "POST",
        body: JSON.stringify({ key, value }),
      }
    );
  },

  bulkUpdate: async (postId: string, meta: Record<string, string>) => {
    return apiRequest<{ meta: Record<string, string> }>(
      `/api/posts/${postId}/meta`,
      {
        method: "PUT",
        body: JSON.stringify({ meta }),
      }
    );
  },

  delete: async (postId: string, key: string) => {
    return apiRequest<{ deleted: string }>(
      `/api/posts/${postId}/meta/${encodeURIComponent(key)}`,
      { method: "DELETE" }
    );
  },
};

// Profiles API
export const profilesApi = {
  get: async (username: string) => {
    return apiRequest(`/api/profiles/${username}`);
  },

  listFollowers: async (username: string) => {
    return apiRequest<{
      items: { remote_actor: string; inbox_url: string; approved: boolean; created_at: string }[];
    }>(`/api/profiles/${username}/followers`);
  },

  listFollowing: async (username: string) => {
    return apiRequest<{
      items: {
        remote_actor: string;
        remote_username: string | null;
        remote_domain: string | null;
        handle: string;
        inbox_url: string;
        activity_id: string;
        accepted: boolean;
        created_at: string;
      }[];
    }>(`/api/profiles/${username}/following`);
  },

  follow: async (username: string, remote: string) => {
    return apiRequest<{ success: boolean; actor: string }>(`/api/profiles/${username}/follow`, {
      method: "POST",
      body: JSON.stringify({ remote }),
    });
  },

  update: async (
    username: string,
    data: {
      full_name?: string;
      bio?: string;
      social_github?: string;
      social_x?: string;
      social_youtube?: string;
      social_reddit?: string;
      social_linkedin?: string;
      social_website?: string;
      support_url?: string;
      support_text?: string;
      avatar_url?: string;
      banner_url?: string;
    }
  ) => {
    return apiRequest(`/api/profiles/${username}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};

// Search API
export const searchApi = {
  search: async (query: string, type?: "post" | "profile") => {
    const params = new URLSearchParams({ q: query });
    if (type) params.set("type", type);
    type SearchItem = { id?: string; username?: string };
    return apiRequest<{ items: SearchItem[] }>(`/api/search?${params}`);
  },
};

// Media API
export interface MediaItem {
  filename: string;
  url: string;
  size: number;
  uploaded_at: string;
  type: string;
  asset_type: "banner" | "post_attachment" | null;
  post_id: string | null;
  post_title: string | null;
}

export const mediaApi = {
  upload: async (file: File, assetType?: "banner" | "post_attachment") => {
    const formData = new FormData();
    formData.append("file", file);
    if (assetType) {
      formData.append("asset_type", assetType);
    }

    const response = await fetch(`${API_BASE}/media/upload`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json() as Promise<{ url: string }>;
  },

  list: async () => {
    return apiRequest<{ items: MediaItem[] }>("/api/media");
  },

  delete: async (filename: string) => {
    return apiRequest<{ message: string }>(`/api/media/${filename}`, {
      method: "DELETE",
    });
  },
};

export interface FollowingFeedItem {
  id: string;
  type: "Create" | "Announce";
  actor: string;
  actor_handle: string | null;
  object_id: string;
  title: string | null;
  summary: string | null;
  content_html: string;
  url: string;
  published_at: string | null;
  received_at: string;
}

export const feedApi = {
  following: async (params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    return apiRequest<{
      items: FollowingFeedItem[];
      nextCursor?: string;
      hasMore: boolean;
    }>(`/api/feed/following${query ? `?${query}` : ""}`);
  },
};

// Onboarding API
export const onboardingApi = {
  getState: async () => {
    return apiRequest<{ completed: boolean }>("/api/onboarding/state");
  },

  complete: async (data: {
    instance_name: string;
    instance_description?: string;
    instance_domain: string;
    admin_username: string;
    admin_password: string;
    admin_email?: string;
    open_registrations: boolean;
    smtp_url?: string;
  }) => {
    return apiRequest("/api/onboarding/complete", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// Settings API
export const settingsApi = {
  get: async () => {
    return apiRequest<{
      id: number;
      instance_name: string;
      instance_description: string | null;
      instance_domain: string;
      open_registrations: boolean;
      admin_email: string | null;
      smtp_url: string | null;
      federation_enabled: boolean;
      following_enabled: boolean;
      use_profile_as_landing: boolean;
      primary_user_id: string | null;
      primary_username: string | null;
      instance_mode: "solo" | "multi";
      local_user_count: number;
      local_users: Array<{ id: string; username: string; role: string }>;
      theme_id: string;
      ai_base_url: string | null;
      ai_api_key: string | null;
      ai_model: string | null;
      ai_max_tokens: number | null;
      ai_temperature: number | null;
      created_at: string;
      updated_at: string;
    }>("/api/settings");
  },

  update: async (data: {
    instance_name?: string;
    instance_description?: string | null;
    instance_domain?: string;
    open_registrations?: boolean;
    admin_email?: string | null;
    smtp_url?: string | null;
    federation_enabled?: boolean;
    following_enabled?: boolean;
    use_profile_as_landing?: boolean;
    primary_user_id?: string | null;
    theme_id?: string;
    ai_base_url?: string | null;
    ai_api_key?: string | null;
    ai_model?: string | null;
    ai_max_tokens?: number | null;
    ai_temperature?: number | null;
  }) => {
    return apiRequest("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  followFromSettings: async (remote: string) => {
    return apiRequest<{
      success: boolean;
      actor: string;
      inbox_url: string;
      accepted: boolean;
    }>("/api/settings/following", {
      method: "POST",
      body: JSON.stringify({ remote }),
    });
  },
};

// Admin API
export interface FeatureFlagItem {
  feature: string;
  enabled: boolean;
  envOverride: boolean;
  envValue: string | null;
}

export const adminApi = {
  getFeatures: async () => {
    return apiRequest<{ features: FeatureFlagItem[] }>("/api/admin/features");
  },

  setFeature: async (feature: string, enabled: boolean) => {
    return apiRequest<FeatureFlagItem>(`/api/admin/features/${feature}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  },

  getFailedDeliveries: async () => {
    return apiRequest<{
      items: {
        activity_id: string;
        remote_inbox: string;
        status: string;
        attempt_count: number;
        last_error: string | null;
        updated_at: string;
        activity_json: unknown | null;
      }[];
    }>("/api/admin/deliveries/failed");
  },
};

// Password Reset API
export const passwordResetApi = {
  forgotPassword: async (email: string) => {
    return apiRequest<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  verifyToken: async (token: string) => {
    return apiRequest<{ valid: boolean }>(
      `/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`
    );
  },

  resetPassword: async (token: string, password: string) => {
    return apiRequest<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },
};

// Bookmarks API
export interface BookmarkItem {
  id: string;
  post_id: string | null;
  url: string | null;
  title: string;
  banner_url: string | null;
  summary: string | null;
  published_at: string | null;
  like_count: number;
  hashtags: string[];
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  created_at: string;
}

export const bookmarksApi = {
  list: async (params?: { limit?: number; cursor?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    const query = searchParams.toString();
    return apiRequest<{
      items: BookmarkItem[];
      nextCursor?: string;
      hasMore: boolean;
    }>(`/api/bookmarks${query ? `?${query}` : ""}`);
  },

  create: async (data: { postId?: string; url?: string; title?: string }) => {
    return apiRequest<{ id: string; post_id: string | null; url: string | null }>(
      "/api/bookmarks",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  delete: async (id: string) => {
    return apiRequest<{ deleted: string }>(`/api/bookmarks/${id}`, {
      method: "DELETE",
    });
  },

  deleteByPost: async (postId: string) => {
    return apiRequest<{ deleted: string }>(`/api/bookmarks/by-post/${postId}`, {
      method: "DELETE",
    });
  },

  check: async (postId: string) => {
    return apiRequest<{ bookmarked: boolean; id: string | null }>(
      `/api/bookmarks/check/${postId}`
    );
  },
};

// Snippets API
export interface SnippetItem {
  id: string;
  title: string;
  description: string | null;
  language: string;
  code: string;
  visibility: string;
  current_version: number;
  fork_of: string | null;
  tags: string[];
  view_count: number;
  user: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  created_at: string;
  updated_at: string;
}

export interface SnippetVersion {
  id: string;
  version: number;
  code: string;
  changelog: string | null;
  created_at: string;
}

export const snippetsApi = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    language?: string;
    user_id?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.language) searchParams.set("language", params.language);
    if (params?.user_id) searchParams.set("user_id", params.user_id);
    const query = searchParams.toString();
    return apiRequest<{
      items: SnippetItem[];
      nextCursor?: string;
      hasMore: boolean;
    }>(`/api/snippets${query ? `?${query}` : ""}`);
  },

  get: async (id: string) => {
    return apiRequest<{
      snippet: SnippetItem;
      versions: SnippetVersion[];
    }>(`/api/snippets/${id}`);
  },

  create: async (data: {
    title: string;
    description?: string;
    language: string;
    code: string;
    visibility?: string;
    tags?: string[];
  }) => {
    return apiRequest<{ id: string }>("/api/snippets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (
    id: string,
    data: {
      title?: string;
      description?: string;
      language?: string;
      code?: string;
      visibility?: string;
      tags?: string[];
      changelog?: string;
    }
  ) => {
    return apiRequest<{ id: string; current_version: number }>(
      `/api/snippets/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  },

  delete: async (id: string) => {
    return apiRequest<{ deleted: string }>(`/api/snippets/${id}`, {
      method: "DELETE",
    });
  },

  fork: async (id: string) => {
    return apiRequest<{ id: string }>(`/api/snippets/${id}/fork`, {
      method: "POST",
    });
  },

  getVersions: async (id: string) => {
    return apiRequest<{ versions: SnippetVersion[] }>(
      `/api/snippets/${id}/versions`
    );
  },
};

// Links API
export interface LinkItem {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  thumbnail: string | null;
  og_image: string | null;
  tags: string[];
  view_count: number;
  is_public: boolean;
  archived_url: string | null;
  user: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  archived_at: string;
}

export const linksApi = {
  list: async (params?: { limit?: number; cursor?: string; user_id?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.user_id) searchParams.set("user_id", params.user_id);
    const query = searchParams.toString();
    return apiRequest<{
      items: LinkItem[];
      nextCursor?: string;
      hasMore: boolean;
    }>(`/api/links${query ? `?${query}` : ""}`);
  },

  get: async (id: string) => {
    return apiRequest<LinkItem>(`/api/links/${id}`);
  },

  create: async (data: {
    url: string;
    title?: string;
    description?: string;
    tags?: string[];
  }) => {
    return apiRequest<{ id: string; url: string; title: string | null }>(
      "/api/links",
      { method: "POST", body: JSON.stringify(data) }
    );
  },

  update: async (
    id: string,
    data: { title?: string; description?: string; tags?: string[]; is_public?: boolean }
  ) => {
    return apiRequest<{ id: string }>(`/api/links/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string) => {
    return apiRequest<{ deleted: string }>(`/api/links/${id}`, {
      method: "DELETE",
    });
  },

  archive: async (id: string) => {
    return apiRequest<{ archived_url: string | null; success: boolean }>(
      `/api/links/${id}/archive`,
      { method: "POST" }
    );
  },
};

// AI Writer API
export const aiApi = {
  generateTitle: async (content: string) => {
    return apiRequest<{ title: string }>("/api/ai/title", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },

  generateOutline: async (topic: string) => {
    return apiRequest<{ outline: string }>("/api/ai/outline", {
      method: "POST",
      body: JSON.stringify({ topic }),
    });
  },

  enhance: async (content: string, action: "expand" | "condense" | "engaging" | "fix-grammar") => {
    return apiRequest<{ content: string }>("/api/ai/enhance", {
      method: "POST",
      body: JSON.stringify({ content, action }),
    });
  },

  generateMeta: async (content: string) => {
    return apiRequest<{ title: string; description: string; tags: string[] }>("/api/ai/meta", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },

  translate: async (content: string, language: string) => {
    return apiRequest<{ content: string; language: string }>("/api/ai/translate", {
      method: "POST",
      body: JSON.stringify({ content, language }),
    });
  },
};

// Reposts API
export const repostsApi = {
  repost: async (postId: string) => {
    return apiRequest<{ id: string; repost_of: string }>(`/api/posts/${postId}/repost`, {
      method: "POST",
    });
  },

  unrepost: async (postId: string) => {
    return apiRequest<{ deleted: string }>(`/api/posts/${postId}/repost`, {
      method: "DELETE",
    });
  },

  getReposts: async (postId: string) => {
    return apiRequest<{
      count: number;
      items: {
        id: string;
        user: { id: string; username: string; full_name: string | null; avatar_url: string | null };
        created_at: string;
      }[];
    }>(`/api/posts/${postId}/reposts`);
  },
};

// Threads API
export interface ThreadPost {
  id: string;
  title: string;
  content_markdown: string;
  like_count: number;
  position: number;
  published_at: string | null;
}

export interface ThreadItem {
  id: string;
  title: string | null;
  user: { id: string; username: string; full_name: string | null; avatar_url: string | null };
  created_at: string;
}

export const threadsApi = {
  create: async (data: {
    title?: string;
    posts: { content_markdown: string; title?: string }[];
  }) => {
    return apiRequest<{ id: string; post_ids: string[] }>("/api/threads", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  get: async (id: string) => {
    return apiRequest<{
      thread: ThreadItem;
      posts: ThreadPost[];
    }>(`/api/threads/${id}`);
  },

  addPost: async (threadId: string, data: { content_markdown: string; title?: string }) => {
    return apiRequest<{ id: string; position: number }>(`/api/threads/${threadId}/posts`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
