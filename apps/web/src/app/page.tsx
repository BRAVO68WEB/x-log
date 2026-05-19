import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";
import {
  isLandingRedirectTarget,
  resolveLandingProfileFromInstance,
} from "@/lib/landing";
import {
  absoluteUrl,
  getActorUrl,
  getDomainFromOrigin,
  getFediverseHandle,
  getOriginFromHeaders,
} from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const hdrs = await headers();
  const origin = getOriginFromHeaders(hdrs);
  const landingPath = await resolveLandingProfileFromInstance(origin, {
    includeSelfOrigin: true,
  });

  if (isLandingRedirectTarget("/", landingPath)) {
    redirect(landingPath);
  }

  return <HomeClient />;
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const hdrs = await headers();
    const base = getOriginFromHeaders(hdrs);
    const res = await fetch(`${base}/api/public/instance`, { cache: "no-store" });
    if (!res.ok) {
      return {
        title: "x-log",
        description: "A federated blog platform built on ActivityPub",
      };
    }
    const s = (await res.json()) as {
      instance_name: string;
      instance_description: string | null;
      instance_domain?: string | null;
      primary_profile?: {
        username: string;
        full_name?: string | null;
        avatar_url?: string | null;
        banner_url?: string | null;
        bio?: string | null;
      } | null;
    };
    const domain = s.instance_domain || getDomainFromOrigin(base);
    const primary = s.primary_profile;
    const authorName = primary?.full_name || primary?.username;
    const actorUrl = primary ? getActorUrl(primary.username, domain) : undefined;
    const handle = primary
      ? getFediverseHandle(primary.username, domain)
      : undefined;
    const image = absoluteUrl(primary?.banner_url || primary?.avatar_url, base);

    return {
      metadataBase: new URL(base),
      title: s.instance_name || "x-log",
      description:
        s.instance_description ||
        "A federated blog platform built on ActivityPub",
      authors:
        authorName && primary
          ? [{ name: authorName, url: `/u/${primary.username}` }]
          : authorName
            ? [{ name: authorName }]
            : undefined,
      creator: authorName,
      publisher: s.instance_name || "x-log",
      alternates: {
        canonical: "/",
        ...(actorUrl
          ? {
              types: {
                "application/activity+json": actorUrl,
              },
            }
          : {}),
      },
      openGraph: {
        title: s.instance_name || "x-log",
        description: s.instance_description || undefined,
        url: "/",
        siteName: s.instance_name || "x-log",
        type: "website",
        images: image ? [image] : undefined,
      },
      twitter: {
        card: image ? "summary_large_image" : "summary",
        title: s.instance_name || "x-log",
        description: s.instance_description || undefined,
        images: image ? [image] : undefined,
      },
      other: {
        ...(handle ? { "fediverse:creator": handle } : {}),
        ...(actorUrl ? { "activitypub:actor": actorUrl } : {}),
      },
    };
  } catch {
    return {
      title: "x-log",
      description: "A federated blog platform built on ActivityPub",
    };
  }
}
