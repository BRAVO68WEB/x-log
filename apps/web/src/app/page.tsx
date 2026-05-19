import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import HomeClient from "./HomeClient";
import {
  isLandingRedirectTarget,
  resolveLandingProfileFromInstance,
} from "@/lib/landing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const hdrs = await headers();
  const host = hdrs.get("host") || "localhost:4000";
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const origin = `${proto}://${host}`;
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
    const host = hdrs.get("host") || "localhost:4000";
    const proto = hdrs.get("x-forwarded-proto") || "http";
    const base = `${proto}://${host}`;
    const res = await fetch(`${base}/api/settings`, { cache: "no-store" });
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
