type LandingInstanceSummary = {
  use_profile_as_landing: boolean;
  primary_profile: {
    username: string;
  } | null;
};

function resolveCandidateUrls({
  selfOrigin,
  includeSelfOrigin = true,
}: {
  selfOrigin?: string;
  includeSelfOrigin?: boolean;
} = {}) {
  const urls: string[] = [];
  const normalizedSelfOrigin = selfOrigin?.replace(/\/$/, "");

  const backendApiUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "");
  if (backendApiUrl) {
    urls.push(`${backendApiUrl}/api/public/instance`);
  }

  const nextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (nextPublicApiUrl) {
    urls.push(`${nextPublicApiUrl}/api/public/instance`);
  }

  if (includeSelfOrigin && normalizedSelfOrigin) {
    urls.push(`${normalizedSelfOrigin}/api/public/instance`);
  }

  return Array.from(new Set(urls)).filter((url) => {
    if (!normalizedSelfOrigin) {
      return true;
    }

    try {
      return new URL(url).origin !== normalizedSelfOrigin;
    } catch {
      return true;
    }
  });
}

export async function resolveLandingProfileFromInstance(
  selfOrigin?: string,
  options: { includeSelfOrigin?: boolean } = {}
): Promise<string | null> {
  const candidateUrls = resolveCandidateUrls({
    selfOrigin,
    includeSelfOrigin: options.includeSelfOrigin,
  });

  for (const url of candidateUrls) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) {
        continue;
      }

      const summary = (await res.json()) as LandingInstanceSummary;
      const useProfileAsLanding = summary?.use_profile_as_landing === true;
      const username = summary?.primary_profile?.username;

      if (useProfileAsLanding && typeof username === "string" && username.trim()) {
        return `/u/${encodeURIComponent(username.trim())}`;
      }

      return null;
    } catch {
      // Continue to next endpoint.
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}
