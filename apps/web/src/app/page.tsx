import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export default function Home() {
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
