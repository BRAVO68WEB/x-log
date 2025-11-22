/**
 * API Client for x-log
 * Centralized API functions for interacting with the backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Helper function to make API requests with credentials
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include", // Include cookies for session
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
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
    return apiRequest<{
      items: any[];
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
    content_blocks?: any;
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
    content_blocks?: any;
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
    return apiRequest<{ items: any[] }>(`/api/search?${params}`);
  },
};

// Media API
export const mediaApi = {
  upload: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_URL}/api/media/upload`, {
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

