import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";

type PublicInstanceSummary = {
  use_profile_as_landing: boolean;
  primary_profile: {
    username: string;
  } | null;
};

export default async function Home() {
  try {
    const hdrs = await headers();
    const host = hdrs.get("host") || "localhost:4000";
    const proto = hdrs.get("x-forwarded-proto") || "http";
    const base = `${proto}://${host}`;
    const res = await fetch(`${base}/api/public/instance`, { cache: "no-store" });

    if (res.ok) {
      const summary = (await res.json()) as PublicInstanceSummary;

      if (
        summary.use_profile_as_landing &&
        summary.primary_profile?.username
      ) {
        redirect(`/u/${summary.primary_profile.username}`);
      }
    }
  } catch {
    // On failure, keep homepage behavior.
  }

  return <HomeClient />;
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const res = await fetch(`/api/settings`, { cache: "no-store" });
    if (!res.ok) {
      return {
        title: "x-log",
        description: "A federated blog platform built on ActivityPub",
      };
    }
    const s = (await res.json()) as {
      instance_name: string;
      instance_description: string | null;
    };
    return {
      title: s.instance_name || "x-log",
      description:
        s.instance_description ||
        "A federated blog platform built on ActivityPub",
      openGraph: {
        title: s.instance_name || "x-log",
        description: s.instance_description || undefined,
        type: "website",
      },
      twitter: {
        card: "summary",
        title: s.instance_name || "x-log",
        description: s.instance_description || undefined,
      },
    };
  } catch {
    return {
      title: "x-log",
      description: "A federated blog platform built on ActivityPub",
    };
  }
}
