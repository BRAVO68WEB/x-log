let currentApiBaseUrl: string | null = null;
let currentApiToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export interface RequestContext {
  apiBaseUrl?: string | null;
  token?: string | null;
}

export function setApiBaseUrl(url: string | null) {
  currentApiBaseUrl = url ? url.replace(/\/+$/, "") : null;
}

export function getApiBaseUrl() {
  return currentApiBaseUrl;
}

export function setApiToken(token: string | null) {
  currentApiToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function getApiOrigin(apiBaseUrl?: string | null) {
  const baseUrl = apiBaseUrl ?? currentApiBaseUrl;
  if (!baseUrl) {
    return "";
  }

  try {
    return new URL(baseUrl).origin;
  } catch {
    return "";
  }
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  context?: RequestContext
): Promise<T> {
  const apiBaseUrl = (context?.apiBaseUrl ?? currentApiBaseUrl)?.replace(/\/+$/, "");
  if (!apiBaseUrl) {
    throw new Error("No instance selected.");
  }

  const headers = new Headers(init?.headers);
  const token = context?.token ?? currentApiToken;

  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    unauthorizedHandler?.();
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
