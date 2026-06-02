import type { Metadata } from "next";
import { headers } from "next/headers";
import UserProfileClient from "./Client";
import {
  absoluteUrl,
  getActorUrl,
  getDomainFromOrigin,
  getFediverseHandle,
  getOriginFromHeaders,
} from "@/lib/seo";

export default function UserProfilePage(props: { params: Promise<{ username: string }> }) {
  return <UserProfileClient {...props} />;
}

export async function generateMetadata({
  params,
}: {
  params: { username: string };
}): Promise<Metadata> {
  const { username } = await params;
  try {
    const hdrs = await headers();
    const base = getOriginFromHeaders(hdrs);
    const res = await fetch(`${base}/api/profiles/${username}`, { cache: "no-store" });
    if (!res.ok) {
      return { title: `${username} — x-log` };
    }
    const profile = (await res.json()) as {
      full_name?: string | null;
      bio?: string | null;
      avatar_url?: string | null;
      banner_url?: string | null;
      instance_domain?: string | null;
      actor_url?: string | null;
    };
    const domain = profile.instance_domain || getDomainFromOrigin(base);
    const actorUrl = profile.actor_url || getActorUrl(username, domain);
    const handle = getFediverseHandle(username, domain);
    const displayName = profile.full_name || username;
    const title = `${displayName} (@${username}) — x-log`;
    const canonical = `/u/${username}`;
    const image = absoluteUrl(profile.banner_url || profile.avatar_url, base);

    return {
      metadataBase: new URL(base),
      title,
      description: profile.bio || undefined,
      authors: [{ name: displayName, url: canonical }],
      creator: displayName,
      alternates: {
        canonical,
        types: {
          "application/activity+json": actorUrl,
          "application/rss+xml": `/${username}.rss`,
          "application/atom+xml": `/${username}.atom`,
        },
      },
      openGraph: {
        title,
        description: profile.bio || undefined,
        url: canonical,
        type: "profile",
        username,
        images: image ? [image] : undefined,
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title,
        description: profile.bio || undefined,
        images: image ? [image] : undefined,
      },
      other: {
        author: displayName,
        "profile:username": username,
        "fediverse:creator": handle,
        "activitypub:actor": actorUrl,
      },
    };
  } catch {
    return { title: `${username} — x-log` };
  }
}
