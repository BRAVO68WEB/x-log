import { AuthGuard } from "@/components/AuthGuard";
import type { Metadata } from "next";
import { headers } from "next/headers";
import SettingsClient from "./Client";

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsClient />
    </AuthGuard>
  );
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
        title: "Instance Settings — x-log",
        description: "Configure your instance",
      };
    }
    const s = (await res.json()) as {
      instance_name: string;
      instance_description: string | null;
    };
    const title = `Instance Settings — ${s.instance_name || "x-log"}`;
    return {
      title,
      description: s.instance_description || "Configure your instance",
      openGraph: {
        title,
        description: s.instance_description || undefined,
        type: "website",
      },
      twitter: {
        card: "summary",
        title,
        description: s.instance_description || undefined,
      },
    };
  } catch {
    return {
      title: "Instance Settings — x-log",
      description: "Configure your instance",
    };
  }
}
