import { getApiOrigin } from "@/api/client";

export function resolveAssetUrl(url?: string | null, apiBaseUrl?: string | null) {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  const origin = getApiOrigin(apiBaseUrl);
  if (!origin) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${origin}${url}`;
  }

  return `${origin}/${url}`;
}
