/**
 * API Client for x-log
 * Centralized API functions for interacting with the backend
 * All requests are proxied through Next.js API routes
 */

// Use relative URLs to proxy through Next.js API routes
const API_BASE = "/api";

// Helper function to make API requests with credentials
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
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
      const publicEndpoints = [
        "/api/posts",
        "/api/profiles",
        "/api/search",
        "/api/feeds",
      ];
      
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
};

// Posts API
export const postsApi = {
  list: async (params?: {
    limit?: number;
    cursor?: string;
    author?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.cursor) searchParams.set("cursor", params.cursor);
    if (params?.author) searchParams.set("author", params.author);

    const query = searchParams.toString();
  interface PostSummary {
    id: string;
    title: string;
    summary?: string | null;
    banner_url?: string | null;
    hashtags: string[];
    like_count: number;
    author: { username: string; full_name?: string | null; avatar_url?: string | null };
    published_at: string | null;
  }
  return apiRequest<{
    items: PostSummary[];
    nextCursor?: string;
    hasMore: boolean;
  }>(`/api/posts${query ? `?${query}` : ""}`);
  },

  get: async (id: string) => {
    return apiRequest(`/api/posts/${id}`);
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

  update: async (id: string, data: {
    title?: string;
    content_markdown?: string;
    content_blocks?: import("@tiptap/core").JSONContent | string;
    banner_url?: string;
    summary?: string;
    hashtags?: string[];
    visibility?: "public" | "unlisted" | "private";
  }) => {
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
};

// Profiles API
export const profilesApi = {
  get: async (username: string) => {
    return apiRequest(`/api/profiles/${username}`);
  },

  listFollowers: async (username: string) => {
    return apiRequest<{ items: { remote_actor: string; inbox_url: string; approved: boolean; created_at: string }[] }>(
      `/api/profiles/${username}/followers`
    );
  },

  listFollowing: async (username: string) => {
    return apiRequest<{ items: { remote_actor: string; inbox_url: string; activity_id: string; accepted: boolean; created_at: string }[] }>(
      `/api/profiles/${username}/following`
    );
  },

  update: async (username: string, data: {
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
  }) => {
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
export const mediaApi = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

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
  }) => {
    return apiRequest("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
};
