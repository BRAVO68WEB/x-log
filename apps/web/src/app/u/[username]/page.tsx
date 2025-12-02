import type { Metadata } from "next";
import { headers } from "next/headers";
import UserProfileClient from "./Client";

export default function UserProfilePage(props: { params: Promise<{ username: string }> }) {
  return <UserProfileClient {...props} />;
}

export async function generateMetadata(
  { params }: { params: { username: string } }
): Promise<Metadata> {
  const { username } = await params;
  try {
    const hdrs = await headers();
    const host = hdrs.get("host") || "localhost:4000";
    const proto = hdrs.get("x-forwarded-proto") || "http";
    const base = `${proto}://${host}`;
    const res = await fetch(`${base}/api/profiles/${username}`, { cache: "no-store" });
    if (!res.ok) {
      return { title: `${username} — x-log` };
    }
    const profile = (await res.json()) as {
      full_name?: string | null;
      bio?: string | null;
      banner_url?: string | null;
    };
    const title = `${profile.full_name || username} — x-log`;
    return {
      title,
      description: profile.bio || undefined,
      openGraph: {
        title,
        description: profile.bio || undefined,
        images: profile.banner_url ? [profile.banner_url] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: profile.bio || undefined,
        images: profile.banner_url ? [profile.banner_url] : undefined,
      },
    };
  } catch {
    return { title: `${username} — x-log` };
  }
}
