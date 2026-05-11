type LandingInstanceSummary = {
  use_profile_as_landing: boolean;
  primary_profile: {
    username: string;
  } | null;
};

function resolveCandidateUrls(selfOrigin?: string) {
  const urls: string[] = [];

  if (selfOrigin) {
    const origin = selfOrigin.replace(/\/$/, "");
    urls.push(`${origin}/api/public/instance`);
  }

  const backendApiUrl = process.env.BACKEND_API_URL?.replace(/\/$/, "");
  if (backendApiUrl) {
    urls.push(`${backendApiUrl}/api/public/instance`);
  }

  const nextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
  if (nextPublicApiUrl) {
    urls.push(`${nextPublicApiUrl}/api/public/instance`);
  }

  return urls;
}

export async function resolveLandingProfileFromInstance(
  selfOrigin?: string
): Promise<string | null> {
  const candidateUrls = resolveCandidateUrls(selfOrigin);

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
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
    }
  }

  return null;
}
